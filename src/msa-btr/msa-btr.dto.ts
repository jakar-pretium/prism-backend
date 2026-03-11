import { IsArray, IsString } from 'class-validator';

export class GetProjectsDto {
    @IsArray()
    @IsString({ each: true })
    metros: string[];
}