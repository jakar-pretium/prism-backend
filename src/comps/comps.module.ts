import { Module } from '@nestjs/common';
import { CompsController } from './comps.controller';
import { CompsService } from './comps.service';
import { ParclLabsModule } from '../services/parcl-labs/parcl-labs.module';
import { CognitoAuthModule } from '../auth/cognito/cognito.module';

@Module({
    imports: [ParclLabsModule, CognitoAuthModule],
    controllers: [CompsController],
    providers: [CompsService],
})

export class CompsModule { }