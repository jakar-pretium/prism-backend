import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class GetCompsDto {
    @IsString()
    @IsNotEmpty()
    address: string;

    @IsString()
    @IsNotEmpty()
    city: string;

    @IsString()
    @IsNotEmpty()
    state: string;

    @IsString()
    @IsNotEmpty()
    zip: string;

    @IsString()
    @IsOptional()
    unit?: string;
}