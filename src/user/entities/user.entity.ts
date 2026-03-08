import { Address } from 'src/address/entities/address.entity';
import { Product } from '../../product/entities/product.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  firstname: string;

  @Column({ length: 100 })
  lastname: string;

  @Index({ unique: true })
  @Column({ length: 150 })
  email: string;

  @Column()
  password: string;

  @Index({ unique: true })
  @Column({ name: 'stripe_account_id', length: 150 })
  stripeAccountId: string;

  @Index({ unique: true })
  @Column({ name: 'stripe_customer_id', length: 150 })
  stripeCustomerId: string;

  @Column({ default: 'user' })
  role: 'user' | 'admin';

  @Column({ type: 'date' })
  dob: Date;

  @Column({ length: 20, nullable: true })
  @Index()
  phone: string;

  @Column({ name: 'is_email_confirmed', type: 'boolean', default: false })
  isEmailConfirmed: boolean;

  @OneToMany(() => Product, (product) => product.user)
  products: Product[];

  @OneToMany(() => Address, (address) => address.user)
  addresses: Address[];

  @Column({ type: 'text', nullable: true })
  refreshToken: string | null

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at?: Date;
}