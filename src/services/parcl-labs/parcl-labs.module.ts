import { Module } from '@nestjs/common';
import { ParclLabsService } from './parcl-labs.service';

@Module({
    providers: [ParclLabsService],
    exports: [ParclLabsService],
})
export class ParclLabsModule { }