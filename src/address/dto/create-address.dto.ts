import {
  IsString,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';

export class CreateAddressDto {

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  streetNumber: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  street: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  state: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  zipCode: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  country: string;

  @IsNotEmpty()
  latitude: number;

  @IsNotEmpty()
  longitude: number;
}