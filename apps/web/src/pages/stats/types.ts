import { BusinessStatsDto } from '@mettig/shared';

export type StatsPeriod = 'day' | 'week' | 'month';

export interface BusinessStatsResponseDto {
  stats: BusinessStatsDto;
}
