import { createHash } from 'crypto';
import { db } from '../db';
import { config } from '../config';

export interface TrackEventParams {
  event_type: string;
  payload?: Record<string, unknown>;
  user_id?: string | null;
  session_id?: string | null;
  device_type?: string | null;
  app_version?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export function hashUserId(userId: string): string {
  return createHash('sha256')
    .update(userId + config.analyticsSalt)
    .digest('hex');
}

/**
 * Fire-and-forget event tracking.
 * Computes anonymous_user_hash from user_id + ANALYTICS_SALT.
 * Never throws — errors are silently swallowed.
 */
export function trackEvent(params: TrackEventParams): void {
  const {
    event_type,
    payload = {},
    user_id = null,
    session_id = null,
    device_type = null,
    app_version = null,
    lat = null,
    lng = null,
  } = params;

  const anonymous_user_hash = user_id ? hashUserId(user_id) : null;

  void db
    .insertInto('events')
    .values({
      event_type,
      payload: JSON.stringify(payload),
      user_id,
      session_id,
      anonymous_user_hash,
      device_type,
      app_version,
      lat: lat !== null ? String(lat) : null,
      lng: lng !== null ? String(lng) : null,
    })
    .execute()
    .catch(() => undefined);
}
