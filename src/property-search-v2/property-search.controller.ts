import { Controller, Get, Query, UseGuards, Post, Body } from '@nestjs/common';
import { PropertySearchMode, PropertySearchV2Service } from './property-search.service';

@Controller('property-search-v2')
export class PropertySearchV2Controller {
    constructor(private readonly propertySearchV2Service: PropertySearchV2Service) { }

    // GET /property-search/autocomplete?q=
    @Get('autocomplete')
    async getAutocomplete(@Query('q') q: string) {
        return this.propertySearchV2Service.getAutocomplete(q);
    }

    @Get('property-search')
    async getPropertySearch(@Query('q') q: string, @Query('mode') mode: string) {
        return this.propertySearchV2Service.getPropertySearch(q, mode as PropertySearchMode);
    }

    @Get('market-context')
    async getMarketContext(@Query('tax_assessor_id') tax_assessor_id: string) {
        return this.propertySearchV2Service.getMarketContext(tax_assessor_id);
    }
}

