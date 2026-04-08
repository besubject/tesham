import { sql } from 'kysely';
import { db } from '../db';
import type { NotificationChannel, NotificationEventType, NotificationStatus } from '../db/types';
import { config } from '../config';

// ─── Expo Push API ────────────────────────────────────────────────────────────

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

async function sendExpoPush(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) return;
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!response.ok) {
      console.error('[ExpoPush] HTTP error:', response.status);
    }
  } catch (err) {
    console.error('[ExpoPush] Failed to send push:', err);
  }
}

// ─── Provider interface ───────────────────────────────────────────────────────

export interface INotificationProvider {
  channel: NotificationChannel;
  sendMessage(phone: string, message: string): Promise<void>;
}

// ─── WhatsApp (mock on MVP — always throws, triggering SMS fallback) ──────────

export class WhatsAppMockProvider implements INotificationProvider {
  channel = 'whatsapp' as const;

  async sendMessage(phone: string, _message: string): Promise<void> {
    console.log(`[MockWhatsApp] Attempted notification to ${phone}`);
    throw new Error('WhatsApp Business API not configured on MVP');
  }
}

// ─── SMS.ru notification provider ────────────────────────────────────────────

interface SmsRuResponse {
  status: string;
  status_code: number;
}

export class SmsRuNotificationProvider implements INotificationProvider {
  channel = 'sms' as const;

  constructor(private readonly apiId: string) {}

  async sendMessage(phone: string, message: string): Promise<void> {
    const msg = encodeURIComponent(message);
    const url = `https://sms.ru/sms/send?api_id=${this.apiId}&to=${phone}&msg=${msg}&json=1`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`SMS.ru HTTP error: ${response.status}`);
    }

    const data = (await response.json()) as SmsRuResponse;
    if (data.status !== 'OK') {
      throw new Error(`SMS.ru error: status_code=${data.status_code}`);
    }
  }
}

// ─── Mock notification provider (dev/test without API key) ───────────────────

export class MockNotificationProvider implements INotificationProvider {
  constructor(public readonly channel: NotificationChannel) {}

  async sendMessage(phone: string, message: string): Promise<void> {
    console.log(`[Mock ${this.channel}] ${phone}: ${message}`);
  }
}

// ─── Internal data shape ──────────────────────────────────────────────────────

interface NotificationData {
  business_phone: string;
  client_name: string;
  service_name: string;
  slot_date: string;
  slot_time: string;
  staff_name: string;
}

// ─── Notification service ─────────────────────────────────────────────────────

const WHATSAPP_TIMEOUT_MS = 2 * 60 * 1000;

export class NotificationService {
  constructor(
    private readonly whatsapp: INotificationProvider,
    private readonly sms: INotificationProvider,
  ) {}

  async notifyBookingCreated(bookingId: string): Promise<void> {
    const data = await this.fetchNotificationData(bookingId);
    if (!data) return;

    const clientDisplay = data.client_name.trim() || 'Клиент';
    const message =
      `Новая запись!\n` +
      `Клиент: ${clientDisplay}\n` +
      `Услуга: ${data.service_name}\n` +
      `Дата: ${data.slot_date} ${data.slot_time}\n` +
      `Мастер: ${data.staff_name}`;

    await this.sendWithFallback(bookingId, data.business_phone, message, 'booking_created');
  }

  async notifyBookingCancelled(bookingId: string): Promise<void> {
    const data = await this.fetchNotificationData(bookingId);
    if (!data) return;

    const clientDisplay = data.client_name.trim() || 'Клиент';
    const message =
      `Запись отменена\n` +
      `Клиент: ${clientDisplay}\n` +
      `Дата: ${data.slot_date} ${data.slot_time}`;

    await this.sendWithFallback(bookingId, data.business_phone, message, 'booking_cancelled');
  }

  async notifyClientBookingConfirmed(bookingId: string): Promise<void> {
    const row = await db
      .selectFrom('bookings as b')
      .innerJoin('slots as sl', 'sl.id', 'b.slot_id')
      .innerJoin('services as sv', 'sv.id', 'b.service_id')
      .innerJoin('businesses as biz', 'biz.id', 'b.business_id')
      .select([
        'b.user_id',
        'biz.name as business_name',
        'sv.name as service_name',
        sql<string>`sl.date::text`.as('slot_date'),
        'sl.start_time as slot_time',
      ])
      .where('b.id', '=', bookingId)
      .executeTakeFirst();

    if (!row) return;

    const tokenRows = await db
      .selectFrom('push_tokens')
      .select('token')
      .where('user_id', '=', row.user_id)
      .execute();

    if (tokenRows.length === 0) return;

    const messages: ExpoPushMessage[] = tokenRows.map((t) => ({
      to: t.token,
      title: 'Запись подтверждена',
      body: `${row.business_name} ждёт вас на ${row.service_name} ${row.slot_date} в ${row.slot_time}`,
      data: { booking_id: bookingId },
    }));

    await sendExpoPush(messages);
  }

  async sendReminderPush(bookingId: string, minutesBefore: number): Promise<void> {
    const row = await db
      .selectFrom('bookings as b')
      .innerJoin('slots as sl', 'sl.id', 'b.slot_id')
      .innerJoin('services as sv', 'sv.id', 'b.service_id')
      .innerJoin('businesses as biz', 'biz.id', 'b.business_id')
      .select([
        'b.user_id',
        'biz.name as business_name',
        'sv.name as service_name',
        sql<string>`sl.date::text`.as('slot_date'),
        'sl.start_time as slot_time',
      ])
      .where('b.id', '=', bookingId)
      .where('b.status', '=', 'confirmed')
      .executeTakeFirst();

    if (!row) return;

    const tokenRows = await db
      .selectFrom('push_tokens')
      .select('token')
      .where('user_id', '=', row.user_id)
      .execute();

    if (tokenRows.length === 0) return;

    const timeLabel = minutesBefore >= 60 ? `${minutesBefore / 60} ч` : `${minutesBefore} мин`;
    const messages: ExpoPushMessage[] = tokenRows.map((t) => ({
      to: t.token,
      title: `Напоминание: через ${timeLabel}`,
      body: `${row.business_name} — ${row.service_name} в ${row.slot_time}`,
      data: { booking_id: bookingId },
    }));

    await sendExpoPush(messages);
  }

  async notifyClientBookingCancelledByBusiness(bookingId: string): Promise<void> {
    const row = await db
      .selectFrom('bookings as b')
      .innerJoin('slots as sl', 'sl.id', 'b.slot_id')
      .innerJoin('services as sv', 'sv.id', 'b.service_id')
      .innerJoin('businesses as biz', 'biz.id', 'b.business_id')
      .select([
        'b.user_id',
        'biz.name as business_name',
        'sv.name as service_name',
        sql<string>`sl.date::text`.as('slot_date'),
        'sl.start_time as slot_time',
      ])
      .where('b.id', '=', bookingId)
      .executeTakeFirst();

    if (!row) return;

    // Fetch push tokens for this user
    const tokenRows = await db
      .selectFrom('push_tokens')
      .select('token')
      .where('user_id', '=', row.user_id)
      .execute();

    if (tokenRows.length === 0) return;

    const messages: ExpoPushMessage[] = tokenRows.map((t) => ({
      to: t.token,
      title: 'Запись отменена',
      body: `${row.business_name} отменил вашу запись на ${row.service_name} (${row.slot_date} ${row.slot_time})`,
      data: { booking_id: bookingId },
    }));

    await sendExpoPush(messages);
  }

  private async sendWithFallback(
    bookingId: string,
    phone: string,
    message: string,
    eventType: NotificationEventType,
  ): Promise<void> {
    // Try WhatsApp first (with 2-minute timeout)
    try {
      await Promise.race([
        this.whatsapp.sendMessage(phone, message),
        new Promise<never>((_, reject) => {
          const timer = setTimeout(
            () => reject(new Error('WhatsApp timeout after 2 minutes')),
            WHATSAPP_TIMEOUT_MS,
          );
          timer.unref(); // allow process to exit if timer is the last active handle
        }),
      ]);
      await this.log(bookingId, 'whatsapp', eventType, phone, message, 'sent', null);
    } catch (err) {
      // Log WhatsApp failure
      await this.log(bookingId, 'whatsapp', eventType, phone, message, 'failed', String(err));

      // SMS fallback
      try {
        await this.sms.sendMessage(phone, message);
        await this.log(bookingId, 'sms', eventType, phone, message, 'sent', null);
      } catch (smsErr) {
        await this.log(bookingId, 'sms', eventType, phone, message, 'failed', String(smsErr));
      }
    }
  }

  private async log(
    bookingId: string,
    channel: NotificationChannel,
    eventType: NotificationEventType,
    phone: string,
    message: string,
    status: NotificationStatus,
    errorMessage: string | null,
  ): Promise<void> {
    await db
      .insertInto('notification_log')
      .values({
        booking_id: bookingId,
        channel,
        event_type: eventType,
        phone,
        message,
        status,
        error_message: errorMessage,
      })
      .execute()
      .catch(() => undefined);
  }

  private async fetchNotificationData(bookingId: string): Promise<NotificationData | null> {
    const row = await db
      .selectFrom('bookings as b')
      .innerJoin('slots as sl', 'sl.id', 'b.slot_id')
      .innerJoin('services as sv', 'sv.id', 'b.service_id')
      .innerJoin('businesses as biz', 'biz.id', 'b.business_id')
      .innerJoin('staff as st', 'st.id', 'b.staff_id')
      .innerJoin('users as u', 'u.id', 'b.user_id')
      .select([
        'biz.phone as business_phone',
        'u.name as client_name',
        'sv.name as service_name',
        sql<string>`sl.date::text`.as('slot_date'),
        'sl.start_time as slot_time',
        'st.name as staff_name',
      ])
      .where('b.id', '=', bookingId)
      .executeTakeFirst();

    if (!row) return null;

    return {
      business_phone: row.business_phone,
      client_name: row.client_name,
      service_name: row.service_name,
      slot_date: row.slot_date,
      slot_time: row.slot_time,
      staff_name: row.staff_name,
    };
  }
}

// ─── Factory & singleton ──────────────────────────────────────────────────────

export function createNotificationService(): NotificationService {
  const whatsapp = new WhatsAppMockProvider();
  const sms = config.smsru.apiId
    ? new SmsRuNotificationProvider(config.smsru.apiId)
    : new MockNotificationProvider('sms');
  return new NotificationService(whatsapp, sms);
}

export const notificationService = createNotificationService();
