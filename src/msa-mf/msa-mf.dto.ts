import { IsArray, IsString } from 'class-validator';

export class GetMultifamilyDataDto {
    @IsArray()
    @IsString({ each: true })
    metros: string[];
}

export class GetMonthlyDataDto {
    @IsArray()
    @IsString({ each: true })
    metros: string[];

    @IsArray()
    @IsString({ each: true })
    categories: string[];

    @IsArray()
    @IsString({ each: true })
    bedroomCategories: string[];
}