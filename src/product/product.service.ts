import { ForbiddenException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Address } from 'src/address/entities/address.entity';

@Injectable()
export class ProductService {

  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,

     @InjectRepository(Address)
    private addressesRepository: Repository<Address>,
  ) {}

  async create(createProductDto: CreateProductDto, userId: number): Promise<Product> {
    
    let address: Address | null = null;

    if (createProductDto.addressId) {
      address = await this.addressesRepository.findOne({
        where: { id: createProductDto.addressId, user: { id: userId } },
      });

      if (!address) {
        throw new ForbiddenException('Invalid address');
      }
    }
    
    const product = this.productsRepository.create({
      ...createProductDto,
      user: { id: userId },
      address
    });

    let saveProduct: Promise<Product>
        
    try {
      saveProduct = this.productsRepository.save(product);
    } catch (err) {
      console.error('Postgresql error:', err);
      throw new InternalServerErrorException(`Failed to save the product: ${err.message}`);
    }

    return saveProduct;
  }

  async findAll(userId: number): Promise<Product[]> {
    return this.productsRepository.find({
      where: { user: { id: userId } },
      relations: ['address'],
      order: { created_at: 'DESC' }, 
    });
  }

  async findNearbyProducts(
    userId: number,
    lat: number,
    lng: number,
    radius: number,
    page: number,
    limit: number
  ): Promise<Product[]> {

    return this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.address', 'address')
      .leftJoin('product.user', 'user')

      .where('user.id != :userId', { userId })
      .andWhere('product.address IS NOT NULL')
      .andWhere('product.price IS NOT NULL')

      // 👇 exclure les produits avec reservation active/pending
      .andWhere((qb) => {
        const subQuery = qb
          .subQuery()
          .select('1')
          .from('reservations', 'reservation')
          .where('reservation.product_id = product.id')
          .andWhere('reservation.state NOT IN (:...states)')
          .getQuery();

        return `NOT EXISTS ${subQuery}`;
      })
      .setParameter('states', ['cancelled', 'expired'])

      .andWhere(
        `(6371000 * acos(
          cos(radians(:lat)) *
          cos(radians(address.latitude)) *
          cos(radians(address.longitude) - radians(:lng)) +
          sin(radians(:lat)) *
          sin(radians(address.latitude))
        )) <= :radius`,
        { lat, lng, radius }
      )

      .orderBy('product.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();
  }

  async update(id: number, updateProductDto: UpdateProductDto, userId: number): Promise<Product> {

    const product = await this.productsRepository.findOne({
      where: { id, user: { id: userId } },
      relations: ['address'],
    });

    if (!product) {
      throw new NotFoundException('Product not found or not yours');
    }

    if (updateProductDto.addressId !== undefined) {

      if (updateProductDto.addressId === null) {
        product.address = null;
      } else {

        const address = await this.addressesRepository.findOne({
          where: { id: updateProductDto.addressId, user: { id: userId } },
        });

        if (!address) {
          throw new ForbiddenException('Invalid address');
        }

        product.address = address;
      }
    }

    // Suppression de addressId pour éviter conflit
    const { addressId, ...data } = updateProductDto;

    Object.assign(product, data);

    try {
      return await this.productsRepository.save(product);
    } catch (err) {
      console.error('Postgresql error:', err);
      throw new InternalServerErrorException(
        `Failed to update the product: ${err.message}`,
      );
    }

  }

  async remove(id: number, userId: number): Promise<void> {
    const product = await this.productsRepository.findOne({
      where: { id: id, user: { id: userId } },
    });

    if (!product) {
      throw new NotFoundException('Product not found or not yours');
    }

    // Soft delete : met deleted_at à la date actuelle
    await this.productsRepository.softDelete(id);
  }
}
