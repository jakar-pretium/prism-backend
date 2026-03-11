import { Controller, Get, Post, Put, UnauthorizedException, UseGuards, Param } from '@nestjs/common';
import { DealsService } from './deals.service';
import { CognitoAuthGuard } from 'src/auth/cognito/cognito.guard';
import { Body } from '@nestjs/common';
import { Deal } from '@prisma/client';
import { CurrentUser } from 'src/auth/current-user.decorator';
import type { CurrentUserType } from 'src/auth/current-user.decorator';
import { CreateAnchorDealReportDto } from './deals.dto';

@Controller('deals')
export class DealsController {
    constructor(private readonly dealsService: DealsService) { }

    @UseGuards(CognitoAuthGuard)
    @Post('create-anchor-deal-report')
    async createAnchorLoanDealReport(@Body() body: CreateAnchorDealReportDto, @CurrentUser() currentUser: CurrentUserType) {

        this.dealsService.handleAnchorDealReport(body, currentUser.sub_id);

        return {
            message: 'Deal report queued successfully',
            data: null,
        };
    }

    @UseGuards(CognitoAuthGuard)
    @Get('anchor')
    async getAnchorLoanDealReport(@CurrentUser() currentUser: CurrentUserType) {
        return this.dealsService.getAnchorDeals(currentUser.sub_id, currentUser.email);
    }

}