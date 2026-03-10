import { Module } from '@nestjs/common';
import { MapboxService } from './mapbox.service';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [ConfigModule],
    providers: [MapboxService],
    exports: [MapboxService],
})
export class MapboxModule { }