import { useEffect, useRef } from 'react';
// @ts-expect-error expo-notifications not in devDependencies
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { apiClient } from '@mettig/shared';

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function requestPermissionsAndGetToken(): Promise<string | null> {
  // On Android, create a default notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  return tokenData.data;
}

/**
 * Registers push token with backend when user is authenticated.
 * Removes token when user logs out (token param becomes null).
 * Handles deep linking when user taps on a notification.
 *
 * @param isAuthenticated - whether user is currently logged in
 */
export function usePushNotifications(isAuthenticated: boolean): void {
  const registeredToken = useRef<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigation = useNavigation<any>();

  // Handle notification response (tap on notification)
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
      const bookingId = response?.notification?.request?.content?.data?.booking_id as string | undefined;
      if (bookingId && isAuthenticated) {
        // Navigate to BookingsList screen when user taps the notification
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navigation as any).navigate('Bookings');
        // Optionally scroll to or highlight the specific booking
        // This could be enhanced with a deep link parameter if needed
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, navigation]);

  useEffect(() => {
    if (!isAuthenticated) {
      // On logout: delete token from backend if we have one cached
      if (registeredToken.current) {
        const token = registeredToken.current;
        registeredToken.current = null;
        void apiClient
          .delete(`/user/push-token/${encodeURIComponent(token)}`)
          .catch(() => undefined);
      }
      return;
    }

    // On login: register push token
    let cancelled = false;

    void (async () => {
      const token = await requestPermissionsAndGetToken();
      if (!token || cancelled) return;

      registeredToken.current = token;
      await apiClient.post('/user/push-token', { token }).catch(() => undefined);
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);
}
