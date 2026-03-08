import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Reservation } from './entities/reservation.entity';
import { Repository } from 'typeorm';
import { InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { ReservationState } from './entities/state';
import { StripeService } from 'src/stripe/stripe.service';

@Processor('reservation')
export class ReservationProcessor extends WorkerHost {

  private readonly logger = new Logger(ReservationProcessor.name);

  constructor(
    private stripeService: StripeService,

    @InjectRepository(Reservation)
    private reservationsRepository: Repository<Reservation>,
  ) {
    super();
  }

  async refundPayment(reservation: Reservation) {

    const { id: reservationId, paymentIntentId } = reservation;

    this.logger.log(`Starting refund for reservation ${reservationId}`); 

    if (!paymentIntentId) {
      this.logger.error(`Missing paymentIntentId for ${reservationId}`);
      throw new Error('Missing paymentIntentId');
    }

    if (reservation.refunded) {
      this.logger.error(`Reservation ${reservationId} already refunded`);
      throw new Error('Already refunded');
    }

    try {
      await this.stripeService.refund(
        reservation.paymentIntentId,
      );

      reservation.refunded = true;

      this.logger.log(`Refund SUCCESS for reservation ${reservationId}`);

    } catch (err) {
      this.logger.error(
        `Refund FAILED for reservation ${reservationId}: ${err.message}`,
      );

      throw err; // 🔁 retry automatique
    }
  }

  async expireReservation(reservationId: number) {

    const reservation = await this.reservationsRepository.findOne({
        where: { id: reservationId },
      });

      if (!reservation) {
        throw new NotFoundException('Reservation not found');
      }

      if (reservation.state !== ReservationState.PENDING && reservation.state !== ReservationState.ACCEPTED) {
        this.logger.log(`Reservation ${reservationId} has not a good state for expire: ${reservation.state}`);
        throw new Error('Error state');
      }

      try {
        await this.reservationsRepository.manager.transaction(async (manager) => {
          await this.refundPayment(reservation);
          reservation.refunded = true;
          reservation.expire();

          await manager.save(reservation);
        });

        this.logger.log(`Expired SUCCESS for reservation ${reservationId}`);
        
      } catch (err) {
        console.error('Postgresql error:', err);
        throw err; // 🔁 déclenche retry BullMQ

      }
  }

  async cancelReservation(reservationId: number, type: 'shopper' | 'seller') {

    this.logger.log(`Starting refund for reservation ${reservationId}`);

      const reservation = await this.reservationsRepository.findOne({
        where: { id: reservationId },
      });

      if (!reservation) {
        throw new NotFoundException('Reservation not found');
      }

      if (reservation.state !== ReservationState.CANCEL_PENDING) {
        this.logger.log(`Reservation ${reservationId} has not a good state for cancel: ${reservation.state}`);
        throw new Error('Error state');
      }

      try {

        await this.reservationsRepository.manager.transaction(async (manager) => {
          await this.refundPayment(reservation);
          reservation.refunded = true;
          reservation.cancel(type);

          await manager.save(reservation);
        });

        this.logger.log(`Refunded SUCCESS for reservation ${reservationId}`);

      } catch (err) {
        this.logger.error(
          `Refund FAILED for reservation ${reservationId}: ${err.message}`,
        );

        reservation.state = ReservationState.FAILED;

        await this.reservationsRepository.save(reservation);

        throw err; // 🔁 déclenche retry BullMQ
      }
  }

  async capturePayment(reservationId: number) {

    this.logger.log(`Starting capture for reservation ${reservationId}`);

      const reservation = await this.reservationsRepository.findOne({
        where: { id: reservationId },
      });
  
      if (!reservation) {
        throw new NotFoundException('Reservation not found');
      }

      if (reservation.state !== ReservationState.CAPTURE_PENDING) {
        this.logger.log(`Reservation ${reservationId} has not a good state for capture: ${reservation.state}`);
        throw new Error('Error state');
      }

      if (!reservation.paymentIntentId) {
        this.logger.error(`Missing paymentIntentId for ${reservationId}`);
        throw new Error('Missing paymentIntentId');
      }

      try {
        await this.stripeService.capturePaymentIntent(
          reservation.paymentIntentId,
        );

        this.logger.log(`Capture SUCCESS for reservation ${reservationId}`);

      } catch (err) {
        this.logger.error(
          `Capture FAILED for reservation ${reservationId}: ${err.message}`,
        );

        reservation.state = ReservationState.FAILED;

        await this.reservationsRepository.save(reservation);

        throw err; // 🔁 déclenche retry BullMQ
      }    
  }


  
  async process(job: Job) {

    if (job.name === 'expire-reservation') {

      const { reservationId } = job.data;
      await this.expireReservation(reservationId)

    } else if (job.name === 'cancel-reservation') {

      const { reservationId, type } = job.data;
      await this.cancelReservation(reservationId, type);

    } else if (job.name === 'capture-payment') {

      const { reservationId } = job.data;
      await this.capturePayment(reservationId);

    }

  }

}