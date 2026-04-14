import type { BusinessDetailDto, StaffItemDto } from '@mettig/shared';

export interface ProfileResponse {
  profile: BusinessDetailDto;
}

export interface StaffResponse {
  staff: StaffItemDto[];
}
