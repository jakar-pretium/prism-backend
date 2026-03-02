import { Module } from '@nestjs/common';
import { CompsController } from './comps.controller';
import { CompsService } from './comps.service';
import { ParclLabsModule } from '../services/parcl-labs/parcl-labs.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [ParclLabsModule, AuthModule,],
    controllers: [CompsController],
    providers: [CompsService],
})

export class CompsModule { }