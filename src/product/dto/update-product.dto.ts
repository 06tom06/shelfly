import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsPositive,
  MaxLength,
  IsDateString,
  IsInt
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateProductDto {

    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    @IsOptional()
    price?: number;

    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    @IsOptional()
    delay?: number;

    @IsDateString()
    @IsOptional()
    expirationDate?: string;

    @Type(() => Number)
    @IsInt()
    @IsOptional()
    addressId?: number
    
}
