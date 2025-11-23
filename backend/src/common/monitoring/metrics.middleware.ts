import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from './metrics.service';

/**
 * Metrics Middleware
 * Tracks HTTP request/response metrics automatically
 */
@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();

    // Capture response
    const originalSend = res.send;
    res.send = function (body) {
      res.send = originalSend; // Restore original

      const duration = Date.now() - start;
      const { method, path } = req;
      const { statusCode } = res;

      // Track metrics asynchronously (don't block response)
      setImmediate(() => {
        try {
          // Clean path (remove IDs and dynamic segments)
          const cleanPath = path
            .replace(/\/[a-f0-9-]{36}/gi, '/:id') // UUID
            .replace(/\/[0-9]+/g, '/:id') // Numeric IDs
            .replace(/\?.*/,

 ''); // Remove query params

          this.metricsService.trackRequest(method, cleanPath, statusCode, duration);
        } catch (error) {
          // Silent fail - don't break the app
          console.error('Metrics tracking error:', error);
        }
      });

      return originalSend.call(this, body);
    }.bind(res);

    next();
  }
}
