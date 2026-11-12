import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('v1/me')
export class MeController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  getMe(@Headers('authorization') authorization?: string) {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!token) throw new UnauthorizedException('Bearer token is required');
    return this.authService.getCurrentUser(token);
  }
}
