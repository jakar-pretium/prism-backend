import { Body, Controller, Post, NotFoundException } from '@nestjs/common';
import { GetCompsDto } from './comps.dto';
import { CompsService } from './comps.service';
import { CognitoAuthGuard } from '../auth/cognito/cognito.guard';
import { UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';


@Controller('comps')
export class CompsController {
    constructor(private readonly compsService: CompsService) { }

    @UseGuards(CognitoAuthGuard)
    @Post()
    async getComps(@Body() body: GetCompsDto, @CurrentUser() currentUser: any) {
        const { address, city, state, zip, unit } = body;

        const comps = await this.compsService.getComps(
            address,
            city,
            state,
            zip,
            unit,
        );

        if (!comps) {
            throw new NotFoundException('No comps found');
        }

        return {
            message: 'Comps fetched successfully',
            data: comps,
        };
    }
}