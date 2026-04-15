import * as SecureStore from 'expo-secure-store';

declare global {
  var __METTIG_TOKEN_NAMESPACE__: string | undefined;
}

function getTokenNamespace(): string {
  return globalThis.__METTIG_TOKEN_NAMESPACE__ ?? 'mettig';
}

function getAccessTokenKey(): string {
  return `${getTokenNamespace()}_access_token`;
}

function getRefreshTokenKey(): string {
  return `${getTokenNamespace()}_refresh_token`;
}

export const tokenStorage = {
  getAccessToken: (): Promise<string | null> => SecureStore.getItemAsync(getAccessTokenKey()),
  setAccessToken: (token: string): Promise<void> =>
    SecureStore.setItemAsync(getAccessTokenKey(), token),
  getRefreshToken: (): Promise<string | null> => SecureStore.getItemAsync(getRefreshTokenKey()),
  setRefreshToken: (token: string): Promise<void> =>
    SecureStore.setItemAsync(getRefreshTokenKey(), token),
  clearTokens: async (): Promise<void> => {
    await SecureStore.deleteItemAsync(getAccessTokenKey());
    await SecureStore.deleteItemAsync(getRefreshTokenKey());
  },
};
