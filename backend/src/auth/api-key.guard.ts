import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    // Validate API key
    const platform = await this.prisma.platform.findUnique({
      where: {
        api_key: apiKey,
        is_active: true,
      },
    });

    if (!platform) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Attach platform to request
    request.platformId = platform.id;
    request.platform = platform;

    return true;
  }
}
