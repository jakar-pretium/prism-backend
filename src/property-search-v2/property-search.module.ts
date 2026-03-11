import { Module } from '@nestjs/common';
import { PropertySearchV2Service } from './property-search.service';
import { PropertySearchV2Controller } from './property-search.controller';
import { MapboxModule } from 'src/services/mapbox/mapbox.module';
import { CognitoAuthModule } from 'src/auth/cognito/cognito.module';
import { ParclLabsModule } from 'src/services/parcl-labs/parcl-labs.module';
import { SnowflakeModule } from 'src/services/snowflake/snowflake.module';

@Module({
    imports: [CognitoAuthModule, MapboxModule, ParclLabsModule, SnowflakeModule],
    providers: [PropertySearchV2Service],
    controllers: [PropertySearchV2Controller],
})
export class PropertySearchV2Module { }