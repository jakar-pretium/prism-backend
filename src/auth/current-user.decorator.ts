import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type CurrentUserType = {
    sub_id: string;
    email: string;
    name: string;
}

export const CurrentUser = createParamDecorator<CurrentUserType>(
    (data: unknown, context: ExecutionContext) => {
        const request = context.switchToHttp().getRequest();
        return request.user as CurrentUserType;
    },
);