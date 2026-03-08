import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  getProfile(@CurrentUser('id') id: number) {
    return this.userService.findOne(id);
  }

  @Patch('me')
  @UseGuards(AuthGuard)
  update(
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser('id') id: number
  ) {
    return this.userService.update(id, updateUserDto);
  }

  @Delete('me')
  @UseGuards(AuthGuard)
  remove(
    @CurrentUser('id') id: number
  ) {
    return this.userService.remove(id);
  }
}
