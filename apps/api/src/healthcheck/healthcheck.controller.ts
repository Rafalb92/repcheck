import { Controller, Get } from '@nestjs/common';
import { HealthService } from './healthcheck.service';
import type { HealthResponse } from '@repcheck/shared';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check(): HealthResponse {
    return this.healthService.getHealth();
  }
}
