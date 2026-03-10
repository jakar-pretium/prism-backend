import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class MapboxService {
    private readonly MAPBOX_API_KEY: string;

    constructor(private readonly configService: ConfigService) {
        this.MAPBOX_API_KEY = this.configService.get<string>('MAPBOX_API_KEY') ?? '';
    }

    async geocode(address: string) {
        const response = await axios.get(
            `https://api.mapbox.com/search/geocode/v6/forward?access_token=${this.MAPBOX_API_KEY}&q=${encodeURIComponent(address)}`
        );

        const features: any[] = response.data.features ?? [];

        const feature =
            features.find((f: any) => f.properties.feature_type === "address") ??
            features.find((f: any) => f.properties.feature_type === "poi") ??
            features.find((f: any) => f.properties.feature_type === "street") ??
            features[0] ??
            null;

        if (!feature) {
            return null;
        }

        return feature;
    }
}