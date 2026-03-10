import { Injectable } from '@nestjs/common';
import snowflake, { type Binds, Connection } from "snowflake-sdk";
import crypto from "crypto";
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SnowflakeService {
    private pool: snowflake.Pool<Connection>;

    // Constructor creates the connection pool
    constructor(private readonly configService: ConfigService) {
        const privateKey = this.buildPrivateKey();

        this.pool = snowflake.createPool(
            // Connection options
            {
                account: this.configService.get<string>('SNOWFLAKE_ACCOUNT') ?? '',
                username: this.configService.get<string>('SNOWFLAKE_USER') ?? '',
                authenticator: "SNOWFLAKE_JWT",
                privateKey,
                application: "strata-backend",
                role: "STRATA_ADMIN_APP",
                warehouse: "AI_WH",
            },
            {
                max: 20, // max number of connections in the pool
                min: 0,
                idleTimeoutMillis: 60000,
                evictionRunIntervalMillis: 60000,
            }
        );
    }

    // execute a query using the connection pool
    async executeQuery<T = any>(
        sqlText: string,
        binds?: Binds
    ): Promise<T[]> {

        return this.pool.use(async (clientConnection) => {
            return new Promise<T[]>((resolve, reject) => {
                clientConnection.execute({
                    sqlText,
                    ...(binds ? { binds } : {}),
                    complete: (err, stmt, _) => {
                        if (err) {
                            return reject(err);
                        }

                        const results: T[] = [];
                        const stream = stmt.streamRows();

                        stream.on('data', (row: T) => {
                            results.push(row);
                        });

                        stream.on('error', (streamErr) => {
                            // log the query that failed
                            reject(streamErr);
                        });

                        stream.on('end', () => {
                            resolve(results);
                        });
                    }
                });
            });
        });
    }

    // Build the private key from the encrypted PEM
    private buildPrivateKey(): string {
        const encryptedPem = Buffer.from(
            this.configService.get<string>('SNOWFLAKE_PRIVATE_KEY') ?? '',
            "base64"
        ).toString("utf8");

        const privateKeyObject = crypto.createPrivateKey({
            key: encryptedPem,
            format: "pem",
            passphrase: this.configService.get<string>('SNOWFLAKE_PRIVATE_KEY_PASSPHRASE') ?? '',
        });

        return privateKeyObject.export({
            format: "pem",
            type: "pkcs8",
        }) as string;
    }
}