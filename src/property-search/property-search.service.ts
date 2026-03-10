import { Injectable } from '@nestjs/common';
import { MapboxService } from '../services/mapbox/mapbox.service';
import { ParclLabsService } from '../services/parcl-labs/parcl-labs.service';
import { NotFoundException } from '@nestjs/common';
import { SnowflakeService } from 'src/services/snowflake/snowflake.service';


@Injectable()
export class PropertySearchService {

    constructor(
        private readonly mapboxService: MapboxService,
        private readonly parclLabsService: ParclLabsService,
        private readonly snowflakeService: SnowflakeService) { }

    async searchProperty(inputAddress: string) {
        const feature = await this.mapboxService.geocode(inputAddress);

        // simple snowflake query to see if connection is working
        const result = await this.snowflakeService.executeQuery('SELECT CURRENT_TIMESTAMP()');
        console.log('result', result);

        if (!feature) {
            throw new NotFoundException('Address not found');
        }

        const address = feature.properties.context.address.name;

        const place = feature.properties.context.place.name;

        const state = feature.properties.context.region.region_code;

        const zip = feature.properties.context.postcode.name;

        const property = await this.parclLabsService.getPropertyByAddress(address, place, state, zip);

        if (!property) {
            throw new NotFoundException('Property not found');
        }

        return property;
    }
}