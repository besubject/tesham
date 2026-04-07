import { apiClient } from '../api/client';
import type { AuthResponseDto, UserDto, UserLanguage } from '../types';

export async function sendCode(phone: string): Promise<void> {
  await apiClient.post('/auth/send-code', { phone });
}

export async function verifyCode(phone: string, code: string): Promise<AuthResponseDto> {
  const { data } = await apiClient.post<AuthResponseDto>('/auth/verify-code', { phone, code });
  return data;
}

export async function updateProfile(params: {
  name?: string;
  language?: UserLanguage;
}): Promise<UserDto> {
  const { data } = await apiClient.patch<UserDto>('/user/me', params);
  return data;
}

export async function deleteAccount(): Promise<void> {
  await apiClient.delete('/user/me');
}
