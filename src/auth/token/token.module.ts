import { Module } from '@nestjs/common';
import { TokenGuard } from './token.guard';

@Module({
    providers: [TokenGuard],
    exports: [TokenGuard],
})
export class TokenAuthModule { }