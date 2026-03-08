import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

import { User } from '../../user/entities/user.entity';
import { Product } from '../../product/entities/product.entity';
import { ReservationState } from './state';
import { ForbiddenException } from '@nestjs/common';

@Entity('reservations')
@Index('unique_active_product', ['product'], {
  unique: true,
  where: `"state" IN ('ACCEPTED','PENDING')`,
})
export class Reservation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Product, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({
    type: 'enum',
    enum: ReservationState,
    default: ReservationState.PENDING,
  })
  state: ReservationState

  @Column({ name: 'payment_intent_id', length: 150 })
  paymentIntentId: string;

  @Column({ type: 'timestamp' })
  expires_at: Date;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @Column({ type: 'boolean', default: false })
  refunded: boolean;

  public isExpired = (): boolean => {
    return this.expires_at.getTime() <= Date.now();
  }

  public isCancel = (): boolean => {
    return this.state === ReservationState.CANCELLED_BY_SELLER || this.state === ReservationState.CANCELLED_BY_SHOPPER
  }

  public request = () => {
    if (this.state !== ReservationState.PENDING) {
      throw new ForbiddenException(
        "Operation forbidden",
      );
    }
    this.state = ReservationState.ACCEPTED
  }

  public expire = () => {
    if (this.state === ReservationState.SOLD || this.isCancel() || this.isExpired()) {
      throw new ForbiddenException(
        "Operation forbidden",
      );
    }
    if (this.state === ReservationState.PENDING) {
      this.state = ReservationState.EXPIRED_BY_SELLER
    } else {
      this.state = ReservationState.EXPIRED_BY_SHOPPER
    }
  }

  public sold = () => {
    if (this.state !== ReservationState.ACCEPTED) {
      throw new ForbiddenException(
        "Operation forbidden",
      );
    }
    this.state = ReservationState.SOLD
  }

  public cancel = (type: 'seller' | 'shopper') => {
    if (this.state === ReservationState.SOLD || this.isCancel() || this.isExpired()) {
      throw new ForbiddenException(
        "Operation forbidden",
      );
    }

    if (type === 'seller') {
      this.state = ReservationState.CANCELLED_BY_SELLER
    } else {
      this.state = ReservationState.CANCELLED_BY_SHOPPER
    }
  }
  
}