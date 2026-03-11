import { Module } from '@nestjs/common';
import { DealsService } from './deals.service';
import { DealsController } from './deals.controller';
import { MapboxModule } from 'src/services/mapbox/mapbox.module';
import { SnowflakeModule } from 'src/services/snowflake/snowflake.module';

@Module({
    imports: [MapboxModule, SnowflakeModule],
    providers: [DealsService],
    controllers: [DealsController],
})
export class DealsModule { }