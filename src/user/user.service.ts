import { 
  ConflictException, 
  Injectable, 
  NotFoundException, 
  InternalServerErrorException, 
  Inject, 
  forwardRef } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StripeService } from 'src/stripe/stripe.service';
import bcrypt from 'node_modules/bcryptjs';
import { AuthService } from 'src/auth/auth.service';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class UserService {

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,

    private stripeService: StripeService,

    @Inject(forwardRef(() => AuthService))
    private authService: AuthService,

    private mailerService: MailerService
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = await this.usersRepository.findOneBy({
      email: createUserDto.email,
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    let stripeCustomerId: string;
    let stripeAccountId: string;

    try {
      stripeCustomerId = await this.stripeService.createCustomer(createUserDto.email);
    } catch (err) {
      throw new InternalServerErrorException('Failed to create Stripe Customer account');
    }

    try {
      stripeAccountId = await this.stripeService.createConnectedAccount(createUserDto.email);
    } catch (err) {
      console.error('Stripe error:', err);
      throw new InternalServerErrorException(`Failed to create Stripe account: ${err.message}`);
    }

    const user = this.usersRepository.create(createUserDto);
    user.stripeAccountId = stripeAccountId
    user.stripeCustomerId = stripeCustomerId
    user.password = await bcrypt.hash(createUserDto.password, 10)
    
    let saveUser: Promise<User>

    try {
      saveUser = this.usersRepository.save(user);
    } catch (err) {
      console.error('Postgresql error:', err);
      throw new InternalServerErrorException(`Failed to save the user: ${err.message}`);
    }

    const token = this.authService.generateEmailToken(user.email);

    const url = `${process.env.API_URL}/auth/confirm-email?token=${token}`;

    await this.mailerService.sendMail({
      to: user.email,
      subject: 'Confirmer votre email',
      html: `
        <div style="font-family: Arial, sans-serif; background:#f5f7fb; padding:40px;">
          <div style="max-width:600px; margin:auto; background:white; padding:30px; border-radius:8px;">
            
            <h2 style="color:#333;">Confirmez votre adresse email</h2>

            <p>Merci de vous être inscrit sur notre plateforme.</p>

            <p>Veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous :</p>

            <div style="text-align:center; margin:30px 0;">
              <a href="${url}" 
                style="background:#4f46e5;color:white;padding:14px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">
                Confirmer mon email
              </a>
            </div>

            <p style="color:#555;">
              Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :
            </p>

            <p style="word-break:break-all; color:#4f46e5;">
              ${url}
            </p>

            <hr style="margin:30px 0;">

            <p style="font-size:12px;color:#888;">
              Si vous n’êtes pas à l’origine de cette inscription, ignorez simplement cet email.
            </p>

          </div>
        </div>
      `,
    });

    return saveUser;
  }

  findOne(id: number): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }

  findOneByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ email });
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException();
    }

    const newUser = Object.assign(user, updateUserDto);

    await this.usersRepository.save(newUser);

    const { password, ...result } = user;
    return result;
  }

  async remove(id: number) {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { firstname, lastname, email } = user

    await this.usersRepository.update(id, {
      firstname: firstname.replace(/./g, "*"),
      lastname: lastname.replace(/./g, "*"),
      email: email.replace(/./g, "*"),
      password: '',
      dob: new Date(),
    });

    await this.usersRepository.softDelete(id);
  }

  async updateRefreshToken(userId: number, refreshToken: string | null) {
    await this.usersRepository.update(userId, { refreshToken })
  }

  async confirmEmail(email: string) {
    const user = await this.usersRepository.findOne({ where: { email } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.isEmailConfirmed = true;

    await this.usersRepository.save(user);
  }
}
