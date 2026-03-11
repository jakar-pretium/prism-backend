import { Module } from '@nestjs/common';
import { MsaBtrService } from './msa-btr.service';
import { MsaBtrController } from './msa-btr.controller';
import { SnowflakeModule } from 'src/services/snowflake/snowflake.module';

@Module({
    imports: [SnowflakeModule],
    providers: [MsaBtrService],
    controllers: [MsaBtrController],
})
export class MsaBtrModule { }