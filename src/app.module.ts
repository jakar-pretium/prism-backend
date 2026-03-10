import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CompsModule } from './comps/comps.module';
import { ConfigModule } from '@nestjs/config';
import { CognitoAuthModule } from './auth/cognito/cognito.module';

@Module({
  imports: [CompsModule, ConfigModule.forRoot({
    isGlobal: true,
  }), CognitoAuthModule],

  controllers: [AppController],

  providers: [AppService],
})
export class AppModule { }
