import {
  forwardRef,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { UserService } from '../user/user.service'
import { JwtService } from '@nestjs/jwt'
import bcrypt from 'node_modules/bcryptjs';
import { jwtConstants } from './constants';

@Injectable()
export class AuthService {
  constructor(
    @Inject(forwardRef(() => UserService))
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async signIn(email: string, pass: string) {
    const user = await this.userService.findOneByEmail(email)
    
    if (!user) {
      throw new UnauthorizedException()
    }

    const isValid = bcrypt.compare(pass, user.password);

    if (!isValid) {
      throw new UnauthorizedException()
    }

    if (!user.isEmailConfirmed) {
      throw new UnauthorizedException('Email not confirmed');
    }

    const payload = { id: user.id, email: user.email, role: user.role }

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '15m',
    })

    const refreshToken = await this.jwtService.signAsync(payload, {
      expiresIn: '7d',
    })

    await this.userService.updateRefreshToken(user.id, refreshToken)

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    }
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken)

      const user = await this.userService.findOne(payload.id)

      if (!user || user.refreshToken !== refreshToken) {
        throw new UnauthorizedException()
      }

      const newPayload = {
        id: user.id,
        email: user.email,
        role: user.role,
      }

      const accessToken = await this.jwtService.signAsync(newPayload, {
        expiresIn: '15m',
      })

      return {
        access_token: accessToken,
      }
    } catch {
      throw new UnauthorizedException()
    }
  }

  async logout(userId: number) {
    await this.userService.updateRefreshToken(userId, null)

    return { message: 'Logged out' }
  }

  generateEmailToken(email: string) {
    return this.jwtService.sign(
      { email },
      { secret: jwtConstants.secret, expiresIn: '15m' },
    );
  }

  async confirmEmail(token: string) {
  const payload = this.jwtService.verify(token);

  await this.userService.confirmEmail(payload.email);

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email confirmé</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #f5f6fa;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
        }
        .container {
          background-color: #ffffff;
          padding: 40px 60px;
          border-radius: 12px;
          box-shadow: 0 8px 20px rgba(0,0,0,0.1);
          text-align: center;
        }
        h1 {
          color: #2E7D32;
          margin-bottom: 20px;
        }
        p {
          font-size: 16px;
          color: #333333;
          margin-bottom: 30px;
        }
        a {
          display: inline-block;
          background-color: #2E7D32;
          color: #fff;
          padding: 12px 24px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
        }
        a:hover {
          background-color: #1b5e20;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Email confirmé ✅</h1>
        <p>Merci ! Votre adresse email a été confirmée avec succès.</p>
      </div>
    </body>
    </html>
  `;
}
}