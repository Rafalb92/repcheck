import { Injectable } from '@nestjs/common';
import type { HealthResponse } from '@repcheck/shared';

@Injectable()
export class HealthService {
  private readonly startTime = Date.now();

  getHealth(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: process.env.npm_package_version ?? '0.0.0',
      checks: [],
    };
  }
}
