import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CompsModule } from './comps/comps.module';
import { ConfigModule } from '@nestjs/config';
import { LoggerMiddleware } from './logger.middleware';
import { PropertySearchModule } from './property-search/property-search.module';
import { MarketOverviewModule } from './market-overview/market-overview.module';
import { DealsModule } from './deals/deals.module';
import { MsaBtrModule } from './msa-btr/msa-btr.module';
import { MsaMfModule } from './msa-mf/msa-mf.module';
import { PropertySearchV2Module } from './property-search-v2/property-search.module';

@Module({
  imports: [
    CompsModule,
    PropertySearchModule,
    PropertySearchV2Module,
    MarketOverviewModule,
    DealsModule,
    MsaBtrModule,
    MsaMfModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})

export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes('*'); // apply to all routes
  }
}
