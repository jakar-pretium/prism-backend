import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import { HttpRequest } from '@smithy/protocol-http';


@Injectable()
export class MarketMapService {
    private readonly AWS_REGION: string;
    private readonly LAMBDA_MAP_METRIC_URL: string;
    private readonly LAMBDA_METRIC_OPTIONS_URL: string;
    private readonly MAP_S3_BUCKET: string;
    private readonly AWS_ACCESS_KEY_ID: string;
    private readonly AWS_SECRET_ACCESS_KEY: string;

    constructor(private readonly configService: ConfigService) {
        this.AWS_REGION = this.configService.get<string>('AWS_REGION') ?? 'us-east-1';
        this.LAMBDA_MAP_METRIC_URL = this.configService.get<string>('LAMBDA_MAP_METRIC_URL') ?? '';
        this.LAMBDA_METRIC_OPTIONS_URL = this.configService.get<string>('LAMBDA_METRIC_OPTIONS_URL') ?? '';
        this.MAP_S3_BUCKET = this.configService.get<string>('MAP_S3_BUCKET') ?? 'pret-ai-general';
        this.AWS_ACCESS_KEY_ID = this.configService.get<string>('AWS_ACCESS_KEY_ID') ?? '';
        this.AWS_SECRET_ACCESS_KEY = this.configService.get<string>('AWS_SECRET_ACCESS_KEY') ?? '';
    }

    async signedLambdaFetch(lambdaUrl: string, method: 'GET' | 'POST', queryParams?: Record<string, string>, body?: string): Promise<any> {
        const url = new URL(lambdaUrl);

        if (queryParams) {
            for (const [k, v] of Object.entries(queryParams)) {
                url.searchParams.set(k, v);
            }
        }

        const signer = new SignatureV4({
            service: 'lambda',
            region: this.AWS_REGION,
            credentials: {
                accessKeyId: this.AWS_ACCESS_KEY_ID,
                secretAccessKey: this.AWS_SECRET_ACCESS_KEY,
            },
            sha256: Sha256,
        });

        const headers: Record<string, string> = {
            'content-type': 'application/json',
            host: url.hostname,
        };
        if (body) {
            headers['content-length'] = String(Buffer.byteLength(body));
        }

        const query: Record<string, string> = {};
        url.searchParams.forEach((v, k) => { query[k] = v; });

        const httpReq = new HttpRequest({
            protocol: url.protocol,
            hostname: url.hostname,
            path: url.pathname,
            query,
            method,
            headers,
            body,
        });

        const signed = await signer.sign(httpReq);
        const { host: _omit, ...signedHeaders } = signed.headers;

        const qs = Object.entries(signed.query ?? {})
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
            .join('&');
        const fetchUrl = `${url.origin}${signed.path}${qs ? '?' + qs : ''}`;

        const res = await fetch(fetchUrl, {
            method: signed.method,
            headers: signedHeaders as Record<string, string>,
            body,
        });

        const text = await res.text();
        let parsed: any;
        try {
            parsed = JSON.parse(text);
            // Unwrap Lambda response envelope if present
            if (parsed && typeof parsed === 'object' && 'statusCode' in parsed && typeof parsed.body === 'string') {
                parsed = JSON.parse(parsed.body);
            }
        } catch {
            throw new Error('Lambda returned invalid JSON');
        }

        if (!res.ok && parsed?.error) throw new Error(parsed.error);
        return parsed;
    }

    async getMetricOptions(): Promise<any[]> {
        try {
            if (!this.LAMBDA_METRIC_OPTIONS_URL) {
                throw new Error('LAMBDA_METRIC_OPTIONS_URL not configured');
            }

            const grainsToFetch = ['MSA', 'ZIP'];
            const allMetrics: any[] = [];

            for (const grain of grainsToFetch) {
                const body = JSON.stringify({ grain });
                const data = await this.signedLambdaFetch(this.LAMBDA_METRIC_OPTIONS_URL, 'POST', undefined, body);
                const metricData: any[] = data?.data || data?.rows || data?.metrics || [];

                const transformed = metricData
                    .filter((item: any) => item != null && item.META_METRIC != null)
                    .map((item: any) => ({
                        ...item,
                        MSA_METRIC: item.MSA_METRIC === true || item.MSA_METRIC === 1 || String(item.MSA_METRIC).toLowerCase() === 'true',
                        ZIP_METRIC: item.ZIP_METRIC === true || item.ZIP_METRIC === 1 || String(item.ZIP_METRIC).toLowerCase() === 'true',
                    }));

                allMetrics.push(...transformed);
            }

            // Deduplicate by META_METRIC, merging flags
            const unique = new Map<string, any>();
            for (const m of allMetrics) {
                const key = m.META_METRIC;
                if (!unique.has(key)) {
                    unique.set(key, m);
                } else {
                    const ex = unique.get(key);
                    unique.set(key, { ...ex, MSA_METRIC: ex.MSA_METRIC || m.MSA_METRIC, ZIP_METRIC: ex.ZIP_METRIC || m.ZIP_METRIC });
                }
            }

            const data = Array.from(unique.values());
            return data;
        } catch (err: any) {
            console.error('Error fetching metric options:', err);
            throw err;
        }
    }

    async getMetricData(metric: string, grain: string): Promise<any> {
        try {
            if (!this.LAMBDA_MAP_METRIC_URL) {
                throw new Error('LAMBDA_MAP_METRIC_URL not configured');
            }

            const data = await this.signedLambdaFetch(this.LAMBDA_MAP_METRIC_URL, 'GET', { metric, grain });

            return data;
        } catch (err: any) {
            const msg = err?.message || '';
            if (msg.includes('does not exist') || msg.includes('NoSuchKey') || msg.includes('not found')) {
                return { data: {}, count: 0, min: 0, max: 0, error: 'metric_not_available' };
            }
            throw new Error('Error fetching metric data');
        }
    }

    async getPMTilesUrl(bucket: string, key: string): Promise<string> {
        try {
            if (!bucket || !key) {
                throw new Error('bucket and key are required');
            }

            const s3 = new S3Client({
                region: this.AWS_REGION, credentials: {
                    accessKeyId: this.AWS_ACCESS_KEY_ID,
                    secretAccessKey: this.AWS_SECRET_ACCESS_KEY,
                }
            });
            const command = new GetObjectCommand({ Bucket: bucket, Key: key });
            const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

            return url;
        } catch (err: any) {
            console.error('Error generating PMTiles presigned URL:', err);
            throw new Error('Error generating PMTiles presigned URL');
        }
    }



}