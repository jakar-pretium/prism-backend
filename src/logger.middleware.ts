import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {

    private getMethodColor(method: string) {
        const colors: Record<string, string> = {
            GET: '\x1b[32m',     // green
            POST: '\x1b[31m',    // red
            PUT: '\x1b[33m',     // yellow
            PATCH: '\x1b[35m',   // magenta
            DELETE: '\x1b[34m',  // blue
        };

        return colors[method] || '\x1b[37m';
    }

    use(req: Request, res: Response, next: NextFunction) {
        const { method, originalUrl, body, query, params } = req;
        const start = Date.now();

        const color = this.getMethodColor(method);
        const reset = '\x1b[0m';

        console.log(`\n${color}${method}${reset} ${originalUrl}`);

        if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
            if (Object.keys(body || {}).length) {
                console.log('Body:', JSON.stringify(body, null, 2));
            }
        }

        if (method === 'GET') {
            if (Object.keys(query || {}).length) {
                console.log('Query:', JSON.stringify(query, null, 2));
            }

            if (Object.keys(params || {}).length) {
                console.log('Params:', JSON.stringify(params, null, 2));
            }
        }

        res.on('finish', () => {
            const duration = Date.now() - start;
            console.log(
                `${color}${method}${reset} ${originalUrl} → ${res.statusCode} (${duration}ms)\n`,
            );
        });

        next();
    }
}