import {
    IsArray,
    IsEnum,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    IsNotEmpty,
    Length,
} from 'class-validator';

export enum PropertyTypes {
    single_family = 'single_family',
    townhome = 'townhome',
    twinhome = 'twinhome',
    other = 'other',
}

export enum LoanType {
    fix_and_flip = 'fix_and_flip',
    new_construction = 'new_construction',
    bridge_to_sale = 'bridge_to_sale',
    other = 'other',
}

export enum ProjectStatus {
    pre_construction = 'pre_construction',
    under_construction = 'under_construction',
    completed = 'completed',
    on_hold = 'on_hold',
}

export class CreateAnchorDealReportDto {
    @IsString()
    @IsOptional()
    deal_name?: string;

    @IsString()
    @IsOptional()
    sponsor?: string;

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
    zip_code: string;

    @IsString()
    @IsOptional()
    unit?: string;

    @IsNumber()
    @IsOptional()
    latitude?: number;

    @IsNumber()
    @IsOptional()
    longitude?: number;

    @IsInt()
    @IsOptional()
    unit_count?: number;

    @IsInt()
    @IsOptional()
    total_lots?: number;

    @IsInt()
    @IsOptional()
    construction_year?: number;

    @IsNumber()
    @IsOptional()
    average_price?: number;

    @IsInt()
    @IsOptional()
    average_size_sf?: number;

    @IsNumber()
    @IsOptional()
    loan_amount?: number;

    @IsEnum(LoanType)
    @IsOptional()
    loan_type?: LoanType;

    @IsEnum(ProjectStatus)
    @IsOptional()
    project_status?: ProjectStatus;

    @IsString()
    @IsOptional()
    notes?: string;

    @IsArray()
    @IsEnum(PropertyTypes, { each: true })
    @IsOptional()
    property_type?: PropertyTypes[];
}