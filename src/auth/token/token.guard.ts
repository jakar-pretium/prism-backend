import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TokenGuard implements CanActivate {
    constructor(private readonly configService: ConfigService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const pretiumToken = request.headers["pretium-token"];

        if (!pretiumToken) {
            throw new UnauthorizedException("Missing pretium-token");
        }

        if (pretiumToken !== this.configService.get<string>('PRETIUM_TOKEN_SECRET')) {
            throw new UnauthorizedException("Invalid pretium-token");
        }

        return true;
    }
}