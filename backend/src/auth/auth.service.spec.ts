import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let mockPrismaService: Partial<PrismaService>;
  let mockJwtService: Partial<JwtService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    password_hash: 'hashed_password',
    name: 'Test User',
    role: 'OPERATOR',
    is_active: true,
    platform_id: null,
    created_at: new Date(),
  };

  beforeEach(async () => {
    mockPrismaService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      } as any,
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
      (mockPrismaService.user.create as jest.Mock).mockResolvedValue(mockUser);

      const registerDto = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      const result = await service.register(registerDto);

      expect(result.user).toBeDefined();
      expect(result.access_token).toBe('mock-jwt-token');
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(mockPrismaService.user.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if user already exists', async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const registerDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });

    it('should hash password before storing', async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
      (mockPrismaService.user.create as jest.Mock).mockResolvedValue(mockUser);

      const registerDto = {
        email: 'test@example.com',
        password: 'plaintext_password',
      };

      await service.register(registerDto);

      expect(bcrypt.hash).toHaveBeenCalledWith('plaintext_password', 10);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            password_hash: 'hashed_password',
          }),
        }),
      );
    });
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const result = await service.login(loginDto);

      expect(result.user).toBeDefined();
      expect(result.access_token).toBe('mock-jwt-token');
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed_password');
    });

    it('should throw UnauthorizedException if user not found', async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      const loginDto = {
        email: 'nonexistent@example.com',
        password: 'password123',
      };

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const loginDto = {
        email: 'test@example.com',
        password: 'wrong_password',
      };

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      const inactiveUser = { ...mockUser, is_active: false };
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(inactiveUser);

      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should generate JWT token with correct payload', async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      await service.login(loginDto);

      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: 'user-123',
        email: 'test@example.com',
        role: 'OPERATOR',
      });
    });
  });

  describe('validateUser', () => {
    it('should return user if valid and active', async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.validateUser('user-123');

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        role: mockUser.role,
        is_active: mockUser.is_active,
        platform_id: mockUser.platform_id,
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.validateUser('nonexistent')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      const inactiveUser = { ...mockUser, is_active: false };
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(inactiveUser);

      await expect(service.validateUser('user-123')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
