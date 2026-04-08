/**
 * Веб-заглушка для expo-secure-store.
 * На мобилках — шифрованное хранилище устройства.
 * На вебе — localStorage (достаточно для dev/admin-панели).
 */

export async function getItemAsync(key: string): Promise<string | null> {
  return localStorage.getItem(key);
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  localStorage.setItem(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  localStorage.removeItem(key);
}
