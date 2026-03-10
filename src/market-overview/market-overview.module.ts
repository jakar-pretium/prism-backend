import { Module } from '@nestjs/common';
import { MarketOverviewService } from './market-overview.service';
import { MarketOverviewController } from './market-overview.controller';
import { CognitoAuthModule } from 'src/auth/cognito/cognito.module';
import { SnowflakeModule } from 'src/services/snowflake/snowflake.module';

@Module({
    imports: [CognitoAuthModule, SnowflakeModule],
    providers: [MarketOverviewService],
    controllers: [MarketOverviewController],
    exports: [MarketOverviewService],
})
export class MarketOverviewModule { }