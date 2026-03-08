import { Controller, Post, Req, Res } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { ReservationService } from 'src/reservation/reservation.service';
import type { Request, Response } from 'express';

@Controller('webhook')
export class StripeController {
  constructor(
    private stripeService: StripeService,
    private reservationService: ReservationService,
  ) {}

  @Post('stripe')
  async handleWebhook(@Req() req: Request, @Res() res: Response) {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).send('Missing Stripe signature');
    }

    let event;

    try {
      event = this.stripeService.constructEventFromPayload(
        signature as string,
        req.body
      );
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const paymentIntent = event.data.object;

    switch (event.type) {

      // 💳 AUTHORIZATION (le plus important en manual)
      case 'payment_intent.amount_capturable_updated': {
        const reservationId = paymentIntent.metadata?.reservationId;

        if (!reservationId) break;

        await this.reservationService.markAsAuthorized(reservationId);

        break;
      }

      // 💰 CAPTURE OK
      case 'payment_intent.succeeded': {
        const reservationId = paymentIntent.metadata?.reservationId;

        if (!reservationId) break;

        await this.reservationService.markAsSold(reservationId);

        break;
      }

      // ❌ FAILED
      case 'payment_intent.payment_failed': {
        const reservationId = paymentIntent.metadata?.reservationId;

        if (!reservationId) break;

        await this.reservationService.markAsFailed(reservationId);

        break;
      }
    }

    return res.json({ received: true });
  }
}