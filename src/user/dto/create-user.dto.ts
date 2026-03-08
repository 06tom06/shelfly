import { IsEmail, IsNotEmpty, IsDateString, MinLength, IsPhoneNumber } from 'class-validator';

export class CreateUserDto {

  @IsNotEmpty()
  firstname: string;

  @IsNotEmpty()
  lastname: string;

  @IsEmail()
  email: string;

  @MinLength(6)
  password: string;

  @IsDateString()
  dob: string;

  @IsPhoneNumber('FR')
  phone: string;
  
}
