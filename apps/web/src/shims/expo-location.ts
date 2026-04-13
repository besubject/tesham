/**
 * Веб-заглушка для expo-location.
 * На вебе geolocation не используется в track-event.
 */

export async function requestForegroundPermissionsAsync(): Promise<{ status: string }> {
  return { status: 'denied' };
}

export async function getCurrentPositionAsync(
  _options?: Record<string, unknown>,
): Promise<{ coords: { latitude: number; longitude: number } } | null> {
  return null;
}
