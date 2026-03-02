import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly cognitoIssuer =
    'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_m0AxpaDJw';
  private readonly cognitoJwksUri = `${this.cognitoIssuer}/.well-known/jwks.json`;

  constructor(private readonly configService: ConfigService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedException('Invalid Authorization header');
    }

    const decoded = await this.verifyAccessToken(token);

    request.user = { sub: decoded.sub };
    request.accessToken = token;

    // load user from database
    let dbUser = await prisma.user.findUnique({
      where: { sub_id: decoded.sub },
    });

    if (dbUser) {
      request.user.email = dbUser.email;
      request.user.name = dbUser.name ?? '';
    } else {
      const cognitoUrl = this.configService.get<string>('COGNITO_URL');

      const { data } = await axios.get(
        `${cognitoUrl}/oauth2/userInfo`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 5000,
        },
      );

      dbUser = await prisma.user.create({
        data: {
          sub_id: decoded.sub,
          email: data.email,
          name: data.given_name,
        },
      });

      request.user.email = data.email;
      request.user.name = data.name;
    }

    return true;
  }

  private async verifyAccessToken(token: string): Promise<{ sub: string }> {
    try {
      const { createRemoteJWKSet, jwtVerify } = await import('jose');
      const jwks = createRemoteJWKSet(new URL(this.cognitoJwksUri));

      const { payload } = await jwtVerify(token, jwks, {
        issuer: this.cognitoIssuer,
      });

      if (!payload.sub) {
        throw new UnauthorizedException('Invalid token');
      }

      return { sub: payload.sub };
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
