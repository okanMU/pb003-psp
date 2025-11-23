import { Test, TestingModule } from '@nestjs/testing';
import { IpBlacklistRule } from './ip-blacklist.rule';
import { RedisService } from '../../../redis/redis.service';
import { FraudContext, FraudRuleType } from '../types/fraud.types';

describe('IpBlacklistRule', () => {
  let rule: IpBlacklistRule;
  let mockRedisService: Partial<RedisService>;
  let mockRedisClient: any;

  beforeEach(async () => {
    mockRedisClient = {
      sismember: jest.fn(),
    };

    mockRedisService = {
      getClient: jest.fn().mockReturnValue(mockRedisClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IpBlacklistRule,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    rule = module.get<IpBlacklistRule>(IpBlacklistRule);
  });

  it('should be defined', () => {
    expect(rule).toBeDefined();
  });

  it('should have correct metadata', () => {
    expect(rule.getName()).toBe('IpBlacklistRule');
    expect(rule.getWeight()).toBe(10);
  });

  describe('check', () => {
    it('should pass when no IP provided', async () => {
      const context: FraudContext = {
        platformId: 'test-platform',
        amount: 100,
      };

      const result = await rule.check(context);

      expect(result.passed).toBe(true);
      expect(result.severity).toBe(0);
      expect(result.message).toContain('No IP');
    });

    it('should fail when IP is blacklisted', async () => {
      mockRedisClient.sismember.mockResolvedValue(1);

      const context: FraudContext = {
        platformId: 'test-platform',
        amount: 100,
        customerIp: '192.168.1.1',
      };

      const result = await rule.check(context);

      expect(result.passed).toBe(false);
      expect(result.ruleType).toBe(FraudRuleType.IP_BLACKLIST);
      expect(result.severity).toBe(10);
      expect(result.message).toContain('blacklisted');
      expect(mockRedisClient.sismember).toHaveBeenCalledWith(
        'security:ip_blacklist',
        '192.168.1.1',
      );
    });

    it('should pass when IP is not blacklisted', async () => {
      mockRedisClient.sismember.mockResolvedValue(0);

      const context: FraudContext = {
        platformId: 'test-platform',
        amount: 100,
        customerIp: '192.168.1.1',
      };

      const result = await rule.check(context);

      expect(result.passed).toBe(true);
      expect(result.severity).toBe(0);
      expect(result.message).toContain('not blacklisted');
    });
  });
});
