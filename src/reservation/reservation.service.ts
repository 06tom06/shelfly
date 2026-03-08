import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException, Res } from '@nestjs/common';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { In, Repository } from 'typeorm';
import { Product } from '../product/entities/product.entity';
import { Reservation } from './entities/reservation.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { ReservationState } from './entities/state';
import { Action } from './dto/action';
import { StripeService } from 'src/stripe/stripe.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { UserService } from 'src/user/user.service';

@Injectable()
export class ReservationService {

  constructor(
    @InjectRepository(Reservation)
    private reservationsRepository: Repository<Reservation>,

    @InjectQueue('reservation')
    private reservationQueue: Queue,

    private stripeService: StripeService,

    private userService: UserService
  ) {}

  async create(userId: number, dto: CreateReservationDto) {
    // 🧱 1. TRANSACTION DB ONLY
    const reservation = await this.reservationsRepository.manager.transaction(
      async (manager) => {
        const product = await manager.getRepository(Product).findOne({
          where: { id: dto.productId },
          relations: ['user'],
          lock: { mode: 'pessimistic_write' },
        });

        if (!product) throw new NotFoundException();
        if (product.user.id === userId)
          throw new ForbiddenException();

        const existing = await manager.getRepository(Reservation).findOne({
          where: {
            product: { id: dto.productId },
            state: In([ReservationState.ACCEPTED, ReservationState.PENDING]),
          },
          lock: { mode: 'pessimistic_read' },
        });

        if (existing) throw new BadRequestException();

        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

        const reservation = manager.getRepository(Reservation).create({
          product,
          user: { id: userId },
          expires_at: expiresAt,
          state: ReservationState.PENDING,
        });

        let saved: Reservation;

        try {
           saved = await manager.getRepository(Reservation).save(reservation);
        } catch (err) {
          console.error('PostgreSQL error:', err);
          throw new InternalServerErrorException(`Failed to save reservation: ${err.message}`);
        }

        await this.reservationQueue.add(
          'expire-reservation',
          { reservationId: saved.id },
          { delay: expiresAt.getTime() - Date.now(), jobId: `expire-${saved.id}` },
        );

        return saved;
      },
    );

    // 🌍 2. APPEL STRIPE (hors transaction)
    const shopper = await this.userService.findOne(userId);
    if (!shopper) {
      throw new NotFoundException('User not found');
    }

    const fullReservation = await this.reservationsRepository.findOne({
      where: { id: reservation.id },
      relations: { product: { user: true } },
    });

    if (!fullReservation) {
      throw new NotFoundException('Reservation not found');
    }  
    
    try {

      const paymentIntent = await this.stripeService.createPaymentIntent(
        Math.round(fullReservation.product.price * 100),
        shopper.stripeCustomerId,
        fullReservation.product.user.stripeAccountId,
        Math.round(fullReservation.product.price * 100 * 0.1),
        fullReservation.id
      ); 

      await this.reservationsRepository.update(reservation.id, {
        paymentIntentId: paymentIntent.id,
      });

      return {
        reservation,
        clientSecret: paymentIntent.client_secret,
      };

    } catch (err) {
      await this.reservationsRepository.update(reservation.id, {
        state: ReservationState.FAILED,
      });
      console.error('PostgreSQL error:', err);
      throw new InternalServerErrorException(`Failed to update reservation: ${err.message}`); 
    }
  }

  findAll(userId: number, type: 'seller' | 'shopper' ): Promise<Reservation[]> {
      
    if ( type === 'seller' ) {

      return this.reservationsRepository.find({
        where: {
          state: ReservationState.ACCEPTED,
          product: {
            user: {
              id: userId,
            },
          },
        },
        relations: {
          product: {
            user: true,
          },
        },
      })

    } else if ( type === 'shopper' ) {

      return this.reservationsRepository.find({
        where: {
          user: {
            id: userId
          }
        },
        relations: {
          user: true
        },
      })

    } else {
      throw new ForbiddenException(
        "Operation forbidden",
      );
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} reservation`;
  }

  async update(
    id: number,
    updateReservationDto: UpdateReservationDto,
    userId: number,
  ) {

    const reservation = await this.reservationsRepository.manager.transaction(
      async (manager) => {
        const reservationRepo = manager.getRepository(Reservation);

        // 🔒 Lock pessimiste
        const reservation = await reservationRepo.findOne({
          where: [
            { id, user: { id: userId } },
            { id, product: { user: { id: userId } } },
          ],
          relations: { user: true, product: { user: true } },
          lock: { mode: 'pessimistic_write' },
        });

        if (!reservation) {
          throw new NotFoundException('Reservation not found');
        }

        switch (updateReservationDto.action) {
          case Action.REQUEST: {
            reservation.request();

            const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
            reservation.expires_at = expiresAt;
            
            break;
          }

         case Action.SOLD: {
            if (reservation.state !== ReservationState.ACCEPTED) {
              throw new BadRequestException('Reservation not accepted');
            }

            await this.safeRemoveJob(`expire-${reservation.id}`);

            reservation.state = ReservationState.CAPTURE_PENDING;

            break;
          }

          case Action.CANCEL: {

            if (
              reservation.state !== ReservationState.PENDING &&
              reservation.state !== ReservationState.ACCEPTED
            ) {
              throw new BadRequestException('Cannot cancel at this stage');
            }

            await this.safeRemoveJob(`expire-${reservation.id}`);
            await this.safeRemoveJob(`capture-${reservation.id}`);
            
            reservation.state = ReservationState.CANCEL_PENDING;

            break;
          }

          default:
            throw new BadRequestException('Invalid action');
        }

        // 💾 Save atomique
        await reservationRepo.save(reservation);

        return reservation;
      },
    );

    switch (updateReservationDto.action) {
        case Action.REQUEST:
      
          await this.reservationQueue.add(
            'expire-reservation',
            { reservationId: reservation.id },
            {
              delay: reservation.expires_at.getTime() - Date.now(),
              jobId: `expire-${reservation.id}`,

            },
          );

        break;

        case Action.CANCEL:
          const type: 'shopper' | 'seller' = reservation.user.id === userId ? 'shopper' : 'seller';

          await this.reservationQueue.add(
            'cancel-reservation',
            { reservationId: reservation.id, type },
            {
              jobId: `refund-${reservation.id}`,
            },
          );

        break;

       case Action.SOLD:

       await this.reservationQueue.add(
          'capture-payment',
          { reservationId: reservation.id },
          {
            jobId: `capture-${reservation.id}`, // idempotence
            attempts: 5, // retry automatique
            backoff: {
              type: 'exponential',
              delay: 3000,
            },
          },
        );
        break;

      default:
        throw new BadRequestException('Invalid action');
    }

    return reservation;
  }

  private async safeRemoveJob(jobId: string) {
    try {
      const job = await this.reservationQueue.getJob(
        jobId
      );
      if (job) {
        await job.remove();
      }
    } catch (err) {
      console.warn('Queue remove failed:', err.message);
    }
  }

  async markAsAuthorized(reservationId: number) {
    const reservation = await this.reservationsRepository.findOne({
      where: { id: reservationId },
    });

    if (!reservation) return;

    // déjà traité ou état invalide
    if (reservation.state !== ReservationState.PENDING) return;

    // expiré → on ignore
    if (reservation.isExpired()) return;

    reservation.state = ReservationState.ACCEPTED;

    await this.reservationsRepository.save(reservation);
  }

  async markAsFailed(reservationId: number) {
    const reservation = await this.reservationsRepository.findOne({
      where: { id: reservationId },
    });

    if (!reservation) return;

    // ⚠️ autorisé seulement dans ces états
    if (
      reservation.state !== ReservationState.PENDING &&
      reservation.state !== ReservationState.CAPTURE_PENDING
    ) {
      return; // ❗ jamais throw ici
    }

    reservation.state = ReservationState.FAILED;

    await this.reservationsRepository.save(reservation);
  }

  async markAsSold(reservationId: number) {

    const reservation = await this.reservationsRepository.findOne({
      where: { id: reservationId },
    });

    if (!reservation) return;
    
    if (reservation.state !== ReservationState.CAPTURE_PENDING) {
      return;
    }

    reservation.state = ReservationState.SOLD;

    await this.reservationsRepository.save(reservation);     
  }

}
