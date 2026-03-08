import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @UseGuards(AuthGuard)
  create(
    @Body() createProductDto: CreateProductDto,
    @CurrentUser('id') userId: number
  ) {
    return this.productService.create(createProductDto, userId);
  }

  @Get()
  @UseGuards(AuthGuard)
  findAll(
    @CurrentUser('id') userId: number
  ) {
    return this.productService.findAll(userId);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  update(
    @Param('id') id: string, 
    @Body() updateProductDto: UpdateProductDto,
    @CurrentUser('id') userId: number
  ) {
    return this.productService.update(parseInt(id), updateProductDto, userId);
  }

  @UseGuards(AuthGuard)
  @Get('/nearby')
  findNearby(
    @CurrentUser('id') userId: number,
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radius') radius: number,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.productService.findNearbyProducts(
      userId,
      Number(lat),
      Number(lng),
      Number(radius),
      Number(page),
      Number(limit),
    );
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  remove(
    @Param('id') id: string, 
    @CurrentUser('id') userId: number
  ) {
      return this.productService.remove(parseInt(id), userId);
  }
}
