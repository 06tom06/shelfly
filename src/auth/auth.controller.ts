import { AuthService } from './auth.service';
import { Body, Controller, Post, HttpCode, UseGuards, Get, Query } from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}


  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.authService.signIn(body.email, body.password)
  }

  @Post('refresh')
  @UseGuards(AuthGuard)
  refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refreshToken(body.refreshToken)
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  logout(@CurrentUser('id') userId: number) {
    return this.authService.logout(userId)
  }

  @Get('confirm-email')
  async confirmEmail(@Query('token') token: string) {
    return this.authService.confirmEmail(token)
  }
}
