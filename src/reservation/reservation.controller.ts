import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('reservations')
export class ReservationController {
  constructor(private readonly reservationService: ReservationService) {}

  @Post()
  @UseGuards(AuthGuard)
  create(
    @Body() createReservationDto: CreateReservationDto,
    @CurrentUser('id') userId: number
  ) {
    return this.reservationService.create(userId, createReservationDto);
  }

  @Get()
  @UseGuards(AuthGuard)
  findAll(
    @CurrentUser('id') userId: number,
    @Query('type') type: 'seller' | 'shopper'
  ) {
    return this.reservationService.findAll(userId, type);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  update(
    @Param('id') id: string, 
    @Body() updateReservationDto: UpdateReservationDto,
    @CurrentUser('id') userId: number    
  ) {
    return this.reservationService.update(+id, updateReservationDto, userId);
  }
}
