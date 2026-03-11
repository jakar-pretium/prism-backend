import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MarketMapService } from './market-map.service';
import { CognitoAuthGuard } from 'src/auth/cognito/cognito.guard';

@Controller('market-map')
export class MarketMapController {
    constructor(private readonly marketMapService: MarketMapService) { }

    @UseGuards(CognitoAuthGuard)
    @Get('metric-options')
    async getMetricOptions() {
        const metricOptionsData = await this.marketMapService.getMetricOptions();
        return {
            message: 'Metric options fetched successfully',
            data: metricOptionsData,
            count: metricOptionsData.length,
        }
    }

    @UseGuards(CognitoAuthGuard)
    @Get('metric-data')
    async getMetricData(@Query('metric') metric: string, @Query('grain') grain: string) {
        const metricData = await this.marketMapService.getMetricData(metric, grain);
        return {
            message: 'Metric data fetched successfully',
            ...metricData,
        }
    }

    @UseGuards(CognitoAuthGuard)
    @Get('pmtiles-url')
    async getPMTilesUrl(@Query('bucket') bucket: string, @Query('key') key: string) {
        const pmtilesUrl = await this.marketMapService.getPMTilesUrl(bucket, key);
        return {
            message: 'PMTiles URL fetched successfully',
            url: pmtilesUrl,
        };
    }
}