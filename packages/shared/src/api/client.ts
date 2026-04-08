import axios, { type AxiosInstance, type InternalAxiosRequestConfig, type AxiosError } from 'axios';
import { tokenStorage } from '../storage/token';
import type { AuthResponseDto } from '../types';

const BASE_URL =
  (typeof process !== 'undefined' && process.env['EXPO_PUBLIC_API_URL']) ||
  'http://localhost:3000';

export function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: BASE_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 10_000,
  });

  client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    const token = await tokenStorage.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  let isRefreshing = false;
  let failedQueue: Array<{ resolve: (value: string) => void; reject: (reason: unknown) => void }> = [];

  const processQueue = (error: unknown, token: string | null): void => {
    failedQueue.forEach(({ resolve, reject }) => {
      if (token) resolve(token);
      else reject(error);
    });
    failedQueue = [];
  };

  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

      if (error.response?.status === 401 && !originalRequest._retry) {
        if (isRefreshing) {
          return new Promise<string>((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          }).then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return client(originalRequest);
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const refreshToken = await tokenStorage.getRefreshToken();
          if (!refreshToken) throw new Error('No refresh token');

          const { data } = await axios.post<AuthResponseDto>(`${BASE_URL}/auth/refresh`, { refreshToken });

          await tokenStorage.setAccessToken(data.accessToken);
          await tokenStorage.setRefreshToken(data.refreshToken);

          processQueue(null, data.accessToken);
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          }
          return client(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          await tokenStorage.clearTokens();
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      return Promise.reject(error);
    },
  );

  return client;
}

export const apiClient = createApiClient();
