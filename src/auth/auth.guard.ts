import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class AuthGuard implements CanActivate {
  private jwks: jwksClient.JwksClient;

  constructor(private readonly configService: ConfigService) {
    this.jwks = jwksClient({
      jwksUri:
        'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_m0AxpaDJw/.well-known/jwks.json',
    });
  }

  private getKey(header, callback) {
    this.jwks.getSigningKey(header.kid, (err, key) => {
      const signingKey = key?.getPublicKey();
      callback(null, signingKey);
    });
  }

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

    const decoded: any = await new Promise((resolve, reject) => {
      jwt.verify(
        token,
        this.getKey.bind(this),
        {
          issuer:
            'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_m0AxpaDJw',
        },
        (err, decodedToken) => {
          if (err || !decodedToken || !decodedToken.sub) {
            reject(new UnauthorizedException('Invalid token'));
          }
          resolve(decodedToken);
        },
      );
    });

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
}