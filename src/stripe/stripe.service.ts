import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  public stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_KEY || '', {
      apiVersion: '2026-02-25.clover',
    });
  }

  async createConnectedAccount(email: string): Promise<string> {
    const account = await this.stripe.accounts.create({
      type: 'express',
      email,
    });

    return account.id
  }

  async createCustomer(email: string): Promise<string> {
    const customer = await this.stripe.customers.create({
      email: email,
    });

    return customer.id
  }

  // Lien d’onboarding pour le vendeur
  async createAccountLink(accountId: string) {
    return this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: 'https://tonsite.com/reauth',
      return_url: 'https://tonsite.com/dashboard',
      type: 'account_onboarding',
    });
  }

  // -------------------------------
  // 2️⃣ Créer un PaymentIntent avec commission
  // -------------------------------
  createPaymentIntent(
    amount: number,
    customerId: string,           // Stripe Customer ID de l'acheteur
    connectedAccountId: string,   // Stripe Connect Account du vendeur
    commission: number,            // Commission plateforme en centimes
    reservationId: number         // ID de la réservation pour le metadata
  ) {

    try {

      return this.stripe.paymentIntents.create({
          amount,
          currency: 'eur',
          customer: customerId,
          automatic_payment_methods: { enabled: true },

          capture_method: 'manual', // Capture manuelle pour contrôler le moment du paiement

          // Commission de la plateforme
          application_fee_amount: commission,

          // Destination : compte vendeur
          transfer_data: {
            destination: connectedAccountId,
          },

          metadata: {
            reservationId
          },
        },
        {
          idempotencyKey: `reservation-${reservationId}`,
        }
      );
      
    } catch (err) {
      console.error('Stripe error:', err);
      throw new InternalServerErrorException(`Failed to create Stripe PaymentIntent: ${err.message}`);
    }
  }

  capturePaymentIntent(paymentIntentId: string) {
    try {
      return this.stripe.paymentIntents.capture(paymentIntentId)
    } catch (err) {
      console.error('Stripe error:', err);
      throw new InternalServerErrorException(`Failed to capture PaymentIntent: ${err.message}`);
    }
  } 
  
  async refund(paymentIntentId: string) {
    return this.stripe.refunds.create({ payment_intent: paymentIntentId });
  }

  async constructEventFromPayload(signature: string, payload: Buffer) {
    try {
      return this.stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch (err) {
      throw new BadRequestException('Invalid Stripe signature');
    }
  }
}