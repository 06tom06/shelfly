import { Module, forwardRef } from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { ReservationController } from './reservation.controller';
import { Reservation } from './entities/reservation.entity';
import { Address } from '../address/entities/address.entity';
import { Product } from '../product/entities/product.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StripeModule } from 'src/stripe/stripe.module';
import { BullModule } from '@nestjs/bullmq';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [
    forwardRef(() => StripeModule),
    BullModule.registerQueue({
      name: 'reservation',
    }),
    TypeOrmModule.forFeature([Product, Address, Reservation]),
    forwardRef(() => UserModule)
  ],
  controllers: [ReservationController],
  providers: [ReservationService],
  exports: [ReservationService]
})
export class ReservationModule {}
