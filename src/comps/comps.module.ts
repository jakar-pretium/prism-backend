import { Module } from '@nestjs/common';
import { CompsController } from './comps.controller';
import { CompsService } from './comps.service';
import { CognitoAuthModule } from '../auth/cognito/cognito.module';
import { ParclLabsModule } from '../services/parcl-labs/parcl-labs.module';

@Module({
    imports: [CognitoAuthModule, ParclLabsModule],
    controllers: [CompsController],
    providers: [CompsService],
})

export class CompsModule { }