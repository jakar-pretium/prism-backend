import { Controller, Get, Post, UseGuards, Body } from '@nestjs/common';
import { MsaBtrService } from './msa-btr.service';
import { CognitoAuthGuard } from 'src/auth/cognito/cognito.guard';
import { GetProjectsDto } from './msa-btr.dto';

@Controller('msa-btr')
export class MsaBtrController {
    constructor(private readonly msaBtrService: MsaBtrService) { }

    @UseGuards(CognitoAuthGuard)
    @Get('builder-metrics')
    async getBuilderMetrics() {
        const builderMetrics = await this.msaBtrService.getBuilderMetrics();

        return {
            message: 'Builder metrics fetched successfully',
            data: builderMetrics,
        };
    }

    @UseGuards(CognitoAuthGuard)
    @Post('projects')
    async getProjects(@Body() body: GetProjectsDto) {
        const projects = await this.msaBtrService.getProjects(body.metros);

        return {
            message: 'Projects fetched successfully',
            data: projects,
        };
    }
}