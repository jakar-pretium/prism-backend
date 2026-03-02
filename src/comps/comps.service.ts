import { Injectable, NotFoundException } from '@nestjs/common';
import { ParclLabsService } from '../services/parcl-labs/parcl-labs.service';

@Injectable()
export class CompsService {
    constructor(private readonly parclLabsService: ParclLabsService) { }

    async getComps(
        address: string,
        city: string,
        state: string,
        zip: string,
        unit?: string,
    ) {
        const property = await this.parclLabsService.getPropertyByAddress(
            address,
            city,
            state,
            zip,
            unit,
        );

        if (!property) {
            throw new NotFoundException('Property not found');
        }

        const comps = await this.parclLabsService.getParclComps(
            property.bedrooms,
            property.bathrooms,
            property.longitude,
            property.latitude,
            property.square_footage,
        );

        return comps;
    }
}