import {
  IsInt,
  IsNotEmpty,
  IsDateString,
} from 'class-validator';

export class CreateReservationDto {
  @IsInt()
  @IsNotEmpty()
  productId: number;
}