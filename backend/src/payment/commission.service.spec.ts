import { Test, TestingModule } from '@nestjs/testing';
import { CommissionService } from './commission.service';
import { ConfigService } from '@nestjs/config';
import { Decimal } from '@prisma/client/runtime/library';

describe('CommissionService', () => {
  let service: CommissionService;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn().mockReturnValue('0.005'), // 0.5% PSP commission
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommissionService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<CommissionService>(CommissionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculate', () => {
    it('should calculate commissions correctly with number inputs', () => {
      const amount = 1000;
      const platformRate = 0.015; // 1.5%

      const result = service.calculate(amount, platformRate);

      expect(result.amount).toBe(1000);
      expect(result.platformCommission).toBe(15); // 1000 * 0.015
      expect(result.pspCommission).toBe(5); // 1000 * 0.005
      expect(result.totalCommission).toBe(20); // 15 + 5
      expect(result.netAmount).toBe(980); // 1000 - 20
    });

    it('should calculate commissions correctly with Decimal inputs', () => {
      const amount = new Decimal(1000);
      const platformRate = new Decimal(0.015);

      const result = service.calculate(amount, platformRate);

      expect(result.amount).toBe(1000);
      expect(result.platformCommission).toBe(15);
      expect(result.pspCommission).toBe(5);
      expect(result.totalCommission).toBe(20);
      expect(result.netAmount).toBe(980);
    });

    it('should handle zero platform commission', () => {
      const amount = 1000;
      const platformRate = 0; // No platform commission

      const result = service.calculate(amount, platformRate);

      expect(result.platformCommission).toBe(0);
      expect(result.pspCommission).toBe(5);
      expect(result.totalCommission).toBe(5);
      expect(result.netAmount).toBe(995);
    });

    it('should round to 2 decimal places', () => {
      const amount = 100.33;
      const platformRate = 0.015;

      const result = service.calculate(amount, platformRate);

      // 100.33 * 0.015 = 1.50495 -> 1.50
      // 100.33 * 0.005 = 0.50165 -> 0.50
      // Net: 100.33 - 1.50 - 0.50 = 98.33
      expect(result.platformCommission).toBe(1.5);
      expect(result.pspCommission).toBe(0.5);
      expect(result.netAmount).toBe(98.33);
    });

    it('should handle large amounts correctly', () => {
      const amount = 1000000; // 1 million
      const platformRate = 0.02; // 2%

      const result = service.calculate(amount, platformRate);

      expect(result.platformCommission).toBe(20000); // 1M * 0.02
      expect(result.pspCommission).toBe(5000); // 1M * 0.005
      expect(result.totalCommission).toBe(25000);
      expect(result.netAmount).toBe(975000);
    });

    it('should handle small amounts correctly', () => {
      const amount = 10;
      const platformRate = 0.015;

      const result = service.calculate(amount, platformRate);

      expect(result.platformCommission).toBe(0.15);
      expect(result.pspCommission).toBe(0.05);
      expect(result.totalCommission).toBe(0.2);
      expect(result.netAmount).toBe(9.8);
    });

    it('should handle different PSP commission rates from config', async () => {
      // Create a new service with different config
      const customConfigService = {
        get: jest.fn().mockReturnValue('0.01'), // 1% PSP commission
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CommissionService,
          {
            provide: ConfigService,
            useValue: customConfigService,
          },
        ],
      }).compile();

      const customService = module.get<CommissionService>(CommissionService);

      const result = customService.calculate(1000, 0.015);

      expect(result.pspCommission).toBe(10); // 1000 * 0.01
      expect(result.platformCommission).toBe(15); // 1000 * 0.015
      expect(result.totalCommission).toBe(25);
      expect(result.netAmount).toBe(975);
    });

    it('should maintain accuracy with multiple calculations', () => {
      const amounts = [100, 500, 1000, 5000, 10000];
      const platformRate = 0.015;

      amounts.forEach((amount) => {
        const result = service.calculate(amount, platformRate);

        // Verify the sum adds up correctly (allowing for rounding)
        const calculatedTotal =
          result.platformCommission + result.pspCommission + result.netAmount;

        expect(Math.abs(calculatedTotal - amount)).toBeLessThan(0.01);
      });
    });

    it('should handle edge case of 0 amount', () => {
      const amount = 0;
      const platformRate = 0.015;

      const result = service.calculate(amount, platformRate);

      expect(result.platformCommission).toBe(0);
      expect(result.pspCommission).toBe(0);
      expect(result.totalCommission).toBe(0);
      expect(result.netAmount).toBe(0);
    });
  });
});
