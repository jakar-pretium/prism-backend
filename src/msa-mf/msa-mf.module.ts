import { Module } from '@nestjs/common';
import { MsaMfService } from './msa-mf.service';
import { MsaMfController } from './msa-mf.controller';
import { SnowflakeModule } from 'src/services/snowflake/snowflake.module';

@Module({
    imports: [SnowflakeModule],
    providers: [MsaMfService],
    controllers: [MsaMfController],
})
export class MsaMfModule { }