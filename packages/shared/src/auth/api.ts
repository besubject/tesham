import { apiClient } from '../api/client';
import type { AuthResponseDto, UserDto, UserLanguage } from '../types';

export async function sendCode(phone: string): Promise<void> {
  await apiClient.post('/auth/send-code', { phone });
}

export async function verifyCode(phone: string, code: string): Promise<AuthResponseDto> {
  const { data } = await apiClient.post<AuthResponseDto>('/auth/verify-code', { phone, code });
  return data;
}

export async function verifyEmailLogin(
  phone: string,
  code: string,
): Promise<Extract<AuthResponseDto, { requiresEmailVerification: false }>> {
  const { data } = await apiClient.post<Extract<AuthResponseDto, { requiresEmailVerification: false }>>(
    '/auth/verify-email-login',
    { phone, code },
  );
  return data;
}

export async function setEmail(email: string): Promise<void> {
  await apiClient.post('/user/email', { email });
}

export async function verifyUserEmail(code: string): Promise<void> {
  await apiClient.post('/user/email/verify', { code });
}

export async function updateProfile(params: {
  name?: string;
  language?: UserLanguage;
}): Promise<UserDto> {
  const { data } = await apiClient.patch<UserDto>('/user/me', params);
  return data;
}

export async function sendDeleteAccountCode(): Promise<void> {
  await apiClient.post('/user/me/delete-code');
}

export async function deleteAccount(code: string): Promise<void> {
  await apiClient.delete('/user/me', { data: { code } });
}
