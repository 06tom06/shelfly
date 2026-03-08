import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { Product } from './entities/product.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Address } from '../address/entities/address.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Address])
  ],
  controllers: [ProductController],
  providers: [ProductService],
})
export class ProductModule {}
