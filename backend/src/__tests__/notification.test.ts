// ─── sql mock helpers ─────────────────────────────────────────────────────────

const mockSqlExecute = jest.fn().mockResolvedValue({ rows: [] });
const mockSqlResult = {
  execute: mockSqlExecute,
  as: jest.fn().mockReturnThis(),
};
const mockSqlFn = jest.fn().mockReturnValue(mockSqlResult);

jest.mock('kysely', () => ({ sql: mockSqlFn }));

// ─── Mock DB ──────────────────────────────────────────────────────────────────

jest.mock('../db', () => {
  const chainable = {
    selectFrom: jest.fn(),
    insertInto: jest.fn(),
    innerJoin: jest.fn(),
    select: jest.fn(),
    where: jest.fn(),
    values: jest.fn(),
    execute: jest.fn(),
    executeTakeFirst: jest.fn(),
  };

  const terminal = new Set(['executeTakeFirst', 'execute']);

  Object.keys(chainable).forEach((key) => {
    if (!terminal.has(key)) {
      const fn = (chainable as Record<string, jest.Mock>)[key];
      if (fn) fn.mockReturnValue(chainable);
    }
  });

  return { db: chainable };
});

// ─── Mock config ──────────────────────────────────────────────────────────────

jest.mock('../config', () => ({
  config: {
    smsru: { apiId: '' }, // no API key → MockNotificationProvider for SMS
    whatsapp: { apiToken: '', phoneNumberId: '' },
  },
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { db } from '../db';
import {
  NotificationService,
  WhatsAppMockProvider,
  MockNotificationProvider,
  SmsRuNotificationProvider,
} from '../services/notification.service';

// ─── Typed mock db ────────────────────────────────────────────────────────────

const mockDb = db as unknown as {
  selectFrom: jest.Mock;
  insertInto: jest.Mock;
  innerJoin: jest.Mock;
  select: jest.Mock;
  where: jest.Mock;
  values: jest.Mock;
  execute: jest.Mock;
  executeTakeFirst: jest.Mock;
};

function reinitChainable(): void {
  mockDb.selectFrom.mockReturnValue(mockDb);
  mockDb.insertInto.mockReturnValue(mockDb);
  mockDb.innerJoin.mockReturnValue(mockDb);
  mockDb.select.mockReturnValue(mockDb);
  mockDb.where.mockReturnValue(mockDb);
  mockDb.values.mockReturnValue(mockDb);
  mockDb.execute.mockResolvedValue([]);
  mockDb.executeTakeFirst.mockResolvedValue(undefined);
}

const mockBookingData = {
  business_phone: '+79001234567',
  client_name: 'Ахмед',
  service_name: 'Стрижка',
  slot_date: '2026-04-10',
  slot_time: '10:00',
  staff_name: 'Руслан',
};

beforeEach(() => {
  jest.resetAllMocks();
  mockSqlFn.mockReturnValue(mockSqlResult);
  mockSqlResult.as.mockReturnThis();
  mockSqlExecute.mockResolvedValue({ rows: [] });
  reinitChainable();
});

// ─── WhatsAppMockProvider ─────────────────────────────────────────────────────

describe('WhatsAppMockProvider', () => {
  it('always throws (MVP mock)', async () => {
    const provider = new WhatsAppMockProvider();
    await expect(provider.sendMessage('+79001234567', 'test')).rejects.toThrow();
  });

  it('has channel = whatsapp', () => {
    const provider = new WhatsAppMockProvider();
    expect(provider.channel).toBe('whatsapp');
  });
});

// ─── MockNotificationProvider ─────────────────────────────────────────────────

describe('MockNotificationProvider', () => {
  it('resolves without error', async () => {
    const provider = new MockNotificationProvider('sms');
    await expect(provider.sendMessage('+79001234567', 'test')).resolves.toBeUndefined();
  });

  it('has the channel passed to constructor', () => {
    const wa = new MockNotificationProvider('whatsapp');
    const sms = new MockNotificationProvider('sms');
    expect(wa.channel).toBe('whatsapp');
    expect(sms.channel).toBe('sms');
  });
});

// ─── NotificationService: notifyBookingCreated ────────────────────────────────

describe('NotificationService.notifyBookingCreated', () => {
  it('sends SMS when WhatsApp fails and logs both attempts', async () => {
    // DB returns booking data
    mockDb.executeTakeFirst.mockResolvedValueOnce(mockBookingData);
    // DB insert for WhatsApp log
    mockDb.execute.mockResolvedValue([]);

    const mockSms = new MockNotificationProvider('sms');
    const sendSpy = jest.spyOn(mockSms, 'sendMessage');

    const service = new NotificationService(new WhatsAppMockProvider(), mockSms);
    await service.notifyBookingCreated('booking-1');

    // SMS was called as fallback
    expect(sendSpy).toHaveBeenCalledTimes(1);
    const [phone, message] = sendSpy.mock.calls[0] ?? [];
    expect(phone).toBe('+79001234567');
    expect(message).toContain('Новая запись');
    expect(message).toContain('Ахмед');
    expect(message).toContain('Стрижка');
    expect(message).toContain('10:00');
    expect(message).toContain('Руслан');
  });

  it('logs WhatsApp failure in notification_log', async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(mockBookingData);
    mockDb.execute.mockResolvedValue([]);

    const service = new NotificationService(
      new WhatsAppMockProvider(),
      new MockNotificationProvider('sms'),
    );
    await service.notifyBookingCreated('booking-1');

    // insertInto('notification_log') called at least twice: whatsapp failed + sms sent
    const insertCalls = mockDb.insertInto.mock.calls as string[][];
    const logCalls = insertCalls.filter((args) => args[0] === 'notification_log');
    expect(logCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('logs SMS as sent when fallback succeeds', async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(mockBookingData);
    mockDb.execute.mockResolvedValue([]);

    const valuesCalls: Array<Record<string, unknown>> = [];
    mockDb.values.mockImplementation((v: Record<string, unknown>) => {
      valuesCalls.push(v);
      return mockDb;
    });

    const service = new NotificationService(
      new WhatsAppMockProvider(),
      new MockNotificationProvider('sms'),
    );
    await service.notifyBookingCreated('booking-1');

    const smsLog = valuesCalls.find((v) => v['channel'] === 'sms' && v['status'] === 'sent');
    expect(smsLog).toBeDefined();
    expect(smsLog?.['event_type']).toBe('booking_created');
  });

  it('does nothing when booking is not found', async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(undefined);

    const mockSms = new MockNotificationProvider('sms');
    const sendSpy = jest.spyOn(mockSms, 'sendMessage');

    const service = new NotificationService(new WhatsAppMockProvider(), mockSms);
    await service.notifyBookingCreated('non-existent');

    expect(sendSpy).not.toHaveBeenCalled();
  });
});

// ─── NotificationService: notifyBookingCancelled ──────────────────────────────

describe('NotificationService.notifyBookingCancelled', () => {
  it('sends SMS fallback with cancel message', async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(mockBookingData);
    mockDb.execute.mockResolvedValue([]);

    const mockSms = new MockNotificationProvider('sms');
    const sendSpy = jest.spyOn(mockSms, 'sendMessage');

    const service = new NotificationService(new WhatsAppMockProvider(), mockSms);
    await service.notifyBookingCancelled('booking-2');

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const [phone, message] = sendSpy.mock.calls[0] ?? [];
    expect(phone).toBe('+79001234567');
    expect(message).toContain('Запись отменена');
    expect(message).toContain('Ахмед');
    expect(message).toContain('10:00');
  });

  it('logs booking_cancelled event type', async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(mockBookingData);
    mockDb.execute.mockResolvedValue([]);

    const valuesCalls: Array<Record<string, unknown>> = [];
    mockDb.values.mockImplementation((v: Record<string, unknown>) => {
      valuesCalls.push(v as Record<string, unknown>);
      return mockDb;
    });

    const service = new NotificationService(
      new WhatsAppMockProvider(),
      new MockNotificationProvider('sms'),
    );
    await service.notifyBookingCancelled('booking-2');

    const entry = valuesCalls.find((v) => v['status'] === 'sent');
    expect(entry?.['event_type']).toBe('booking_cancelled');
  });

  it('does nothing when booking is not found', async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(undefined);

    const mockSms = new MockNotificationProvider('sms');
    const sendSpy = jest.spyOn(mockSms, 'sendMessage');

    const service = new NotificationService(new WhatsAppMockProvider(), mockSms);
    await service.notifyBookingCancelled('non-existent');

    expect(sendSpy).not.toHaveBeenCalled();
  });
});

// ─── Fallback when both WhatsApp and SMS fail ────────────────────────────────

describe('NotificationService: double failure', () => {
  it('does not throw when both providers fail', async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(mockBookingData);
    mockDb.execute.mockResolvedValue([]);

    const failingSms: INotificationProvider = {
      channel: 'sms',
      sendMessage: jest.fn().mockRejectedValue(new Error('SMS failed')),
    };

    const service = new NotificationService(new WhatsAppMockProvider(), failingSms);
    await expect(service.notifyBookingCreated('booking-3')).resolves.toBeUndefined();
  });
});

// ─── SmsRuNotificationProvider ────────────────────────────────────────────────

describe('SmsRuNotificationProvider', () => {
  it('has channel = sms', () => {
    const provider = new SmsRuNotificationProvider('test-api-id');
    expect(provider.channel).toBe('sms');
  });

  it('throws on HTTP error', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    const provider = new SmsRuNotificationProvider('test-api-id');
    await expect(provider.sendMessage('+79001234567', 'test')).rejects.toThrow('SMS.ru HTTP error');
  });

  it('throws on non-OK API status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ERROR', status_code: 202 }),
    });
    const provider = new SmsRuNotificationProvider('test-api-id');
    await expect(provider.sendMessage('+79001234567', 'test')).rejects.toThrow(
      'SMS.ru error: status_code=202',
    );
  });

  it('resolves on successful API response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'OK', status_code: 100 }),
    });
    const provider = new SmsRuNotificationProvider('test-api-id');
    await expect(provider.sendMessage('+79001234567', 'test')).resolves.toBeUndefined();
  });
});

// ─── Type helper (used in double failure test) ────────────────────────────────

interface INotificationProvider {
  channel: 'whatsapp' | 'sms';
  sendMessage(phone: string, message: string): Promise<void>;
}
