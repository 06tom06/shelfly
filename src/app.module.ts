import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { StripeModule } from './stripe/stripe.module';
import { ReservationModule } from './reservation/reservation.module';
import { AddressModule } from './address/address.module';
import { ProductModule } from './product/product.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq'

@Module({
  imports: [
    AuthModule, 
    UserModule,
    BullModule.forRoot({
      connection: {
        host: 'localhost',
        port: 6379,
      },
    }),
    ConfigModule.forRoot({
      isGlobal: true
    }),
    MailerModule.forRoot({
      transport: {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: 'thomas.suignard.ts@gmail.com',
          pass: process.env.SMTP_SECRET,
        },
      },
      defaults: {
        from: '"Shelfly" <noreply@shelfly.com>',
      },
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'dpg-d6s0p6ruibrs73e2bv80-a',
      port: 5432,
      username: 'shelflydatabaseuser',            // utilisateur PostgreSQL
      password: process.env.DATABASE_PASSWORD,            // mot de passe
      database: 'shelfly_database',          // base créée
      entities: [__dirname + '/**/*.entity{.ts,.js}'], // chemin vers tes entités
      synchronize: true,            // synchronise automatiquement les tables
    }),
    ProductModule,
    AddressModule,
    ReservationModule,
    StripeModule,

  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
    constructor(private dataSource: DataSource) {}
}
