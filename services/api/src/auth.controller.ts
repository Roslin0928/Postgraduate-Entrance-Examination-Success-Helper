import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('wechat-login')
  login(@Body() body: { code?: unknown }) {
    if (typeof body?.code !== 'string') throw new BadRequestException('code must be a string');
    return this.authService.loginByWechat(body.code);
  }
}
