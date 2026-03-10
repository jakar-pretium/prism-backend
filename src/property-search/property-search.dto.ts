import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class GetPropertySearchQueryDto {
    @IsString()
    @IsNotEmpty()
    address: string;
}