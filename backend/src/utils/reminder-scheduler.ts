import { sql } from 'kysely';
import { db } from '../db';
import { notificationService } from '../services/notification.service';

// ─── Sent-reminder cache (in-memory, resets on restart) ───────────────────────
// Key format: "{bookingId}_{24h|30m}"
const sentReminders = new Set<string>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns all confirmed booking IDs whose slot datetime falls within
 * [now + (minutesBefore - windowMinutes), now + (minutesBefore + windowMinutes)].
 */
async function findBookingsNearTime(
  minutesBefore: number,
  windowMinutes: number,
): Promise<string[]> {
  const now = new Date();
  const targetMs = now.getTime() + minutesBefore * 60 * 1000;
  const lowerMs = targetMs - windowMinutes * 60 * 1000;
  const upperMs = targetMs + windowMinutes * 60 * 1000;

  // Convert slot (date + start_time) to a timestamptz and compare
  const rows = await db
    .selectFrom('bookings as b')
    .innerJoin('slots as sl', 'sl.id', 'b.slot_id')
    .select('b.id')
    .where('b.status', '=', 'confirmed')
    .where(
      sql<boolean>`(sl.date + sl.start_time::time) AT TIME ZONE 'UTC' >= ${new Date(lowerMs)}`,
    )
    .where(
      sql<boolean>`(sl.date + sl.start_time::time) AT TIME ZONE 'UTC' <= ${new Date(upperMs)}`,
    )
    .execute();

  return rows.map((r) => r.id);
}

// ─── Scheduler tick ───────────────────────────────────────────────────────────

async function tick(): Promise<void> {
  try {
    // 24-hour reminders (±5 min window)
    const ids24h = await findBookingsNearTime(24 * 60, 5);
    for (const id of ids24h) {
      const key = `${id}_24h`;
      if (!sentReminders.has(key)) {
        sentReminders.add(key);
        void notificationService.sendReminderPush(id, 24 * 60).catch(() => undefined);
      }
    }

    // 30-minute reminders (±5 min window)
    const ids30m = await findBookingsNearTime(30, 5);
    for (const id of ids30m) {
      const key = `${id}_30m`;
      if (!sentReminders.has(key)) {
        sentReminders.add(key);
        void notificationService.sendReminderPush(id, 30).catch(() => undefined);
      }
    }
  } catch (err) {
    console.error('[ReminderScheduler] Tick error:', err);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startReminderScheduler(): void {
  if (intervalHandle) return;
  // Run every 60 seconds
  intervalHandle = setInterval(() => {
    void tick();
  }, 60 * 1000);
  // Allow process to exit even if timer is pending
  intervalHandle.unref();
  console.log('[ReminderScheduler] Started (60s interval)');
}

export function stopReminderScheduler(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
