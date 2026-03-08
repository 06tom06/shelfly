import { Module, forwardRef } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { StripeController } from './stripe.controller';
import { ReservationModule } from 'src/reservation/reservation.module';

@Module({
  imports: [
    forwardRef(() => ReservationModule )
  ],
  controllers: [StripeController],
  providers: [StripeService],
  exports: [StripeService]
})
export class StripeModule {}
