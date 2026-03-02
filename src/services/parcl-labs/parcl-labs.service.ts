import { Injectable } from '@nestjs/common';
import axios from 'axios';
import https from 'https';
import { ConfigService } from '@nestjs/config';

const API_BASE_URL = 'https://api.parcllabs.com';
const SEARCH_ADDRESS_PATH = '/v1/property/search_address';

@Injectable()
export class ParclLabsService {
    constructor(private readonly configService: ConfigService) { }

    async getParclComps(
        numBeds: number,
        numBaths: number,
        longitude: number,
        latitude: number,
        sqft: number,
    ) {
        try {
            const payload: any = {};

            payload.property_filters = {
                property_types: ['SINGLE_FAMILY', 'TOWNHOUSE', 'CONDO', 'OTHER'],
                current_on_market_rental_flag: true,
                min_beds: Math.floor(numBeds) - 1,
                max_beds: Math.floor(numBeds) + 1,
                min_baths: Math.floor(numBaths) - 1,
                max_baths: Math.floor(numBaths) + 1,
                min_sqft: Math.floor(sqft * 0.8),
                max_sqft: Math.floor(sqft * 1.2),
            };

            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

            payload.event_filters = {
                event_names: ['LISTED_RENT'],
                min_event_date: ninetyDaysAgo.toISOString().split('T')[0],
                include_full_event_history: false,
            };

            payload.geo_coordinates = {
                latitude,
                longitude,
                radius: 10,
            };

            const response = await axios.post(
                'https://api.parcllabs.com/v2/property_search?limit=5',
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `${this.configService.get<string>('PARCL_LABS_API_KEY')}`,
                    },
                    timeout: 30000,
                    httpsAgent: new https.Agent({
                        rejectUnauthorized: false,
                    }),
                },
            );

            const data = response.data?.data ?? [];

            for (const property of data) {
                property.events = property.events?.slice(0, 1) ?? [];
                property.distance = this.getDistance(
                    longitude,
                    latitude,
                    property.property_metadata.longitude,
                    property.property_metadata.latitude,
                );
                property.source = 'parcl labs';
            }

            return data;
        } catch (error) {
            console.error(`⚠️ Error getting comps: ${error}`);
            return null;
        }
    }

    getDistance(
        longitude: number,
        latitude: number,
        longitude2: number,
        latitude2: number,
    ) {
        const R = 3958.8;
        const dLat = (latitude2 - latitude) * (Math.PI / 180);
        const dLon = (longitude2 - longitude) * (Math.PI / 180);

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(latitude * (Math.PI / 180)) *
            Math.cos(latitude2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return parseFloat((R * c).toFixed(2));
    }

    async getPropertyByAddress(
        address: string,
        city: string,
        state: string,
        zip: string,
        unit?: string,
    ) {
        try {
            const payload: any[] = [
                {
                    address,
                    zip_code: zip,
                    city,
                    state_abbreviation: state,
                },
            ];

            if (unit) {
                payload[0].unit = unit;
            }

            const response = await axios.post(
                `${API_BASE_URL}${SEARCH_ADDRESS_PATH}`,
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `${this.configService.get<string>('PARCL_LABS_API_KEY')}`,
                    },
                    timeout: 30000,
                    httpsAgent: new https.Agent({
                        rejectUnauthorized: false,
                    }),
                },
            );

            const items = response.data?.items;

            if (!items || items.length === 0) {
                return null;
            }

            return items[0];
        } catch (error) {
            console.error(`⚠️ Error getting property by address: ${error}`);
            return null;
        }
    }
}