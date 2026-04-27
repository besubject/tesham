import { apiClient } from '@mettig/shared';

type EventType =
  | 'analytics_dashboard_opened'
  | 'analytics_period_changed'
  | 'clients_screen_opened'
  | 'client_segment_filtered'
  | 'client_card_opened'
  | 'broadcast_wizard_opened'
  | 'broadcast_audience_selected'
  | 'broadcast_created';

interface EventPayload {
  [key: string]: unknown;
}

let sessionId: string | null = null;

function getSessionId(): string {
  if (!sessionId) {
    sessionId = crypto.randomUUID();
  }
  return sessionId;
}

export async function trackEvent(params: {
  event_type: EventType;
  payload?: EventPayload;
}): Promise<void> {
  try {
    await apiClient
      .post('/events', {
        event_type: params.event_type,
        session_id: getSessionId(),
        device_type: 'web',
        app_version: '1.0.0',
        timestamp: new Date().toISOString(),
        ...(params.payload ?? {}),
      })
      .catch(() => undefined);
  } catch {
    // silently fail
  }
}
