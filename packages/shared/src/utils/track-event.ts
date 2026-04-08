import { apiClient } from '../api/client';
import * as Application from 'expo-application';
import * as Location from 'expo-location';

// ─── Types ────────────────────────────────────────────────────────────────

export type EventType =
  | 'app_open'
  | 'search_query'
  | 'business_card_view'
  | 'booking_start'
  | 'booking_complete'
  | 'booking_cancel'
  | 'favorite_add'
  | 'favorite_remove'
  | 'navigation_click'
  | 'instagram_click'
  | 'review_submit';

export interface EventPayload {
  [key: string]: unknown;
}

interface TrackEventParams {
  event_type: EventType;
  payload?: EventPayload;
}

// ─── Session management ───────────────────────────────────────────────────

let sessionId: string | null = null;

function getSessionId(): string {
  if (!sessionId) {
    sessionId = generateUUID();
  }
  return sessionId;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Device info collection ───────────────────────────────────────────────

async function getDeviceInfo(): Promise<{
  device_type: 'ios' | 'android';
  app_version: string;
  latitude?: number;
  longitude?: number;
}> {
  const info = {
    device_type: (Application.nativeApplicationVersion?.includes('ios') ? 'ios' : 'android') as 'ios' | 'android',
    app_version: Application.nativeApplicationVersion || '1.0.0',
  };

  // Try to get location (if permitted)
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const location = await Location.getCurrentPositionAsync({});
      return {
        ...info,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    }
  } catch (error) {
    // Location not available, continue without it
    console.debug('[TrackEvent] Location not available');
  }

  return info;
}

// ─── Main tracking function ───────────────────────────────────────────────

export async function trackEvent(params: TrackEventParams): Promise<void> {
  try {
    const deviceInfo = await getDeviceInfo();
    const payload = {
      event_type: params.event_type,
      session_id: getSessionId(),
      ...deviceInfo,
      timestamp: new Date().toISOString(),
      ...(params.payload || {}),
    };

    // Send to backend
    await apiClient.post('/events', { ...payload }).catch(() => {
      // Silently fail - don't block app if analytics is down
      console.debug('[TrackEvent] Failed to send event:', params.event_type);
    });
  } catch (error) {
    console.debug('[TrackEvent] Error tracking event:', error);
  }
}

// ─── Helper functions for common events ────────────────────────────────────

export async function trackAppOpen(): Promise<void> {
  await trackEvent({ event_type: 'app_open' });
}

export async function trackSearchQuery(query: string, resultsCount: number): Promise<void> {
  await trackEvent({
    event_type: 'search_query',
    payload: { query, results_count: resultsCount },
  });
}

export async function trackBusinessCardView(businessId: string, businessName: string): Promise<void> {
  await trackEvent({
    event_type: 'business_card_view',
    payload: { business_id: businessId, business_name: businessName },
  });
}

export async function trackBookingStart(businessId: string, serviceId: string): Promise<void> {
  await trackEvent({
    event_type: 'booking_start',
    payload: { business_id: businessId, service_id: serviceId },
  });
}

export async function trackBookingComplete(bookingId: string, businessId: string): Promise<void> {
  await trackEvent({
    event_type: 'booking_complete',
    payload: { booking_id: bookingId, business_id: businessId },
  });
}

export async function trackBookingCancel(bookingId: string): Promise<void> {
  await trackEvent({
    event_type: 'booking_cancel',
    payload: { booking_id: bookingId },
  });
}

export async function trackFavoriteAdd(businessId: string): Promise<void> {
  await trackEvent({
    event_type: 'favorite_add',
    payload: { business_id: businessId },
  });
}

export async function trackFavoriteRemove(businessId: string): Promise<void> {
  await trackEvent({
    event_type: 'favorite_remove',
    payload: { business_id: businessId },
  });
}

export async function trackReviewSubmit(businessId: string, rating: number): Promise<void> {
  await trackEvent({
    event_type: 'review_submit',
    payload: { business_id: businessId, rating },
  });
}
