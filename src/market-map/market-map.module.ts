import { Module } from '@nestjs/common';
import { MarketMapService } from './market-map.service';
import { MarketMapController } from './market-map.controller';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [ConfigModule],
    providers: [MarketMapService],
    controllers: [MarketMapController],
})
export class MarketMapModule { }