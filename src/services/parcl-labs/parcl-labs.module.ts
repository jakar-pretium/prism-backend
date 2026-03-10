import { Module } from '@nestjs/common';
import { ParclLabsService } from './parcl-labs.service';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [ConfigModule],
    providers: [ParclLabsService],
    exports: [ParclLabsService],
})
export class ParclLabsModule { }