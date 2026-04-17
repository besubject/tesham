import { ServiceItemDto, StaffItemDto } from '@mettig/shared';

export interface StaffListDto {
  staff: StaffItemDto[];
}

export interface CurrentStaffDto {
  staff: StaffItemDto;
}

export interface ServicesListDto {
  services: ServiceItemDto[];
}

export interface WalkInModalProps {
  opened: boolean;
  onClose: () => void;
  onCreated: () => void;
}
