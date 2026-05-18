export type HealthStatus = 'ok' | 'degraded' | 'down';

export interface HealthCheck {
  name: string;
  status: HealthStatus;
  latencyMs?: number;
  message?: string;
}

export interface HealthResponse {
  status: HealthStatus;
  timestamp: string; // ISO 8601
  uptime: number; // sekundy od startu procesu
  version: string; // z package.json
  checks: HealthCheck[]; // pusty na razie, później DB/S3/Redis
}
