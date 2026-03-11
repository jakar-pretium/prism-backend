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

    async reverseGeocode(latitude: string, longitude: string) {
        const response = await axios.get(`https://api.mapbox.com/search/geocode/v6/reverse?access_token=${this.MAPBOX_API_KEY}&longitude=${longitude}&latitude=${latitude}`);
        // return the feature with properties.feature_type = "address"
        const feature = response.data.features.find((feature: any) => feature.properties.feature_type === "address");
        if (!feature) {
            return null;
        }
        return {
            address: feature.properties.context.address.name,
            city: feature.properties.context.place.name,
            state: feature.properties.context.region.region_code,
            zip: feature.properties.context.postcode.name,
        }
    }
}