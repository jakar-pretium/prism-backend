import { Controller, Get, Query, UseGuards, Post, Body } from '@nestjs/common';
import { PropertySearchService } from './property-search.service';
import { CognitoAuthGuard } from 'src/auth/cognito/cognito.guard';
import { GetPropertySearchQueryDto } from './property-search.dto';


@Controller('property-search')
export class PropertySearchController {
    constructor(private readonly propertySearchService: PropertySearchService) { }

    @UseGuards(CognitoAuthGuard)
    @Post('address')
    async searchProperty(@Body() body: GetPropertySearchQueryDto) {
        return this.propertySearchService.searchProperty(body.address);
    }
}