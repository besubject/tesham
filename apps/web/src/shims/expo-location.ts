/**
 * Веб-заглушка для expo-location.
 * На вебе geolocation не используется в track-event.
 */

export async function requestForegroundPermissionsAsync(): Promise<{ status: string }> {
  return { status: 'denied' };
}

export async function getCurrentPositionAsync(): Promise<null> {
  return null;
}
