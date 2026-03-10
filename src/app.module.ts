import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CompsModule } from './comps/comps.module';
import { ConfigModule } from '@nestjs/config';
import { LoggerMiddleware } from './logger.middleware';
import { PropertySearchModule } from './property-search/property-search.module';
import { MarketOverviewModule } from './market-overview/market-overview.module';

@Module({
  imports: [
    CompsModule,
    PropertySearchModule,
    MarketOverviewModule,
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
