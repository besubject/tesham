import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'mettig_access_token';
const REFRESH_TOKEN_KEY = 'mettig_refresh_token';

export const tokenStorage = {
  getAccessToken: (): Promise<string | null> => SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
  setAccessToken: (token: string): Promise<void> => SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token),
  getRefreshToken: (): Promise<string | null> => SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  setRefreshToken: (token: string): Promise<void> => SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token),
  clearTokens: async (): Promise<void> => {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },
};
