import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { Address } from './entities/address.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class AddressService {

  constructor(
    @InjectRepository(Address)
    private addressesRepository: Repository<Address>,
  ) {}

  async create(userId: number, createAddressDto: CreateAddressDto): Promise<Address> {
    
    const address = this.addressesRepository.create({
      ...createAddressDto,
      user: { id: userId }
    });

    let saveAddress: Promise<Address>
    
    try {
      saveAddress = this.addressesRepository.save(address);
    } catch (err) {
      console.error('Postgresql error:', err);
      throw new InternalServerErrorException(`Failed to save the address: ${err.message}`);
    }


    return saveAddress;
  }

  async findAll(userId: number): Promise<Address[]> {
    return this.addressesRepository.find({
      where: { user: { id: userId } },
      order: { created_at: 'DESC' }, // optionnel, trie par création
    });
  }

  findOne(id: number) {
    return `This action returns a #${id} address`;
  }

  update(id: number, updateAddressDto: UpdateAddressDto) {
    return `This action updates a #${id} address`;
  }

  remove(id: number) {
    return `This action removes a #${id} address`;
  }
}
