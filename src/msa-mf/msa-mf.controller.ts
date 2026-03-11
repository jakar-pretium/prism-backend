import { Controller, Get, Post, UseGuards, Body, Query } from '@nestjs/common';
import { MsaMfService } from './msa-mf.service';
import { CognitoAuthGuard } from 'src/auth/cognito/cognito.guard';
import { GetMultifamilyDataDto, GetMonthlyDataDto } from './msa-mf.dto';

@Controller('msa-mf')
export class MsaMfController {
    constructor(private readonly msaMfService: MsaMfService) { }

    @UseGuards(CognitoAuthGuard)
    @Post('data')
    async getMultifamilyData(@Body() body: GetMultifamilyDataDto) {
        const multifamilyData = await this.msaMfService.getMultifamilyData(body.metros);

        return {
            message: 'Multifamily data fetched successfully',
            data: multifamilyData,
        };
    }

    @UseGuards(CognitoAuthGuard)
    @Get('all-msas')
    async getAllMSAs() {
        const allMSAs = await this.msaMfService.getAllMSAs();

        return {
            message: 'All MSAs fetched successfully',
            data: allMSAs,
        };
    }

    @UseGuards(CognitoAuthGuard)
    @Post('monthly-data')
    async getMonthlyData(@Body() body: GetMonthlyDataDto) {
        const monthlyData = await this.msaMfService.getMonthlyData(body.metros, body.categories, body.bedroomCategories);

        return {
            message: 'Monthly data fetched successfully',
            data: monthlyData,
        };
    }
}