import { config } from '../config';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface ISmsProvider {
  sendOtp(phone: string, code: string): Promise<void>;
}

// ─── SMS.ru implementation ───────────────────────────────────────────────────

interface SmsRuResponse {
  status: string;
  status_code: number;
  sms?: Record<string, { status: string; status_code: number }>;
}

export class SmsRuProvider implements ISmsProvider {
  private readonly apiId: string;

  constructor(apiId: string) {
    this.apiId = apiId;
  }

  async sendOtp(phone: string, code: string): Promise<void> {
    const msg = encodeURIComponent(`Ваш код подтверждения Mettig: ${code}`);
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

// ─── Mock implementation (for test/dev without API key) ──────────────────────

export class MockSmsProvider implements ISmsProvider {
  async sendOtp(phone: string, code: string): Promise<void> {
    console.log(`[MockSMS] OTP for ${phone}: ${code}`);
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createSmsProvider(): ISmsProvider {
  if (config.smsru.apiId) {
    return new SmsRuProvider(config.smsru.apiId);
  }
  return new MockSmsProvider();
}
