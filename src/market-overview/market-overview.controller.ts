import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MarketOverviewService } from './market-overview.service';
import { CognitoAuthGuard } from 'src/auth/cognito/cognito.guard';

@Controller('market-overview')
export class MarketOverviewController {
    constructor(private readonly marketOverviewService: MarketOverviewService) { }

    @UseGuards(CognitoAuthGuard)
    @Get('dropdown-data')
    async getDropdownData(@Query('geoLevel') geoLevel: string) {
        return this.marketOverviewService.getDropdownData(geoLevel);
    }

    @UseGuards(CognitoAuthGuard)
    @Get('market-data')
    async getMarketTrackerData(@Query('metric') metric: string, @Query('propertyType') propertyType: string, @Query('geoLevel') geoLevel: string, @Query('region') region: string) {
        return this.marketOverviewService.getMarketTrackerData(metric, propertyType, geoLevel, region);
    }

}