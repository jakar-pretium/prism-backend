import { Module } from '@nestjs/common';
import { PropertySearchService } from './property-search.service';
import { PropertySearchController } from './property-search.controller';
import { MapboxModule } from 'src/services/mapbox/mapbox.module';
import { CognitoAuthModule } from 'src/auth/cognito/cognito.module';
import { ParclLabsModule } from 'src/services/parcl-labs/parcl-labs.module';
import { SnowflakeModule } from 'src/services/snowflake/snowflake.module';

@Module({
    imports: [CognitoAuthModule, MapboxModule, ParclLabsModule, SnowflakeModule],
    providers: [PropertySearchService],
    controllers: [PropertySearchController],
    exports: [PropertySearchService],
})
export class PropertySearchModule { }