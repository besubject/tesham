import nodemailer from 'nodemailer';
import { config } from '../config';

// ─── In-memory stores for email codes ────────────────────────────────────────

interface CodeEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}

// For profile email verification (binding email to account)
const verifyEmailStore = new Map<string, CodeEntry>(); // key: userId

// For login email verification (after long inactivity)
const loginEmailStore = new Map<string, CodeEntry>(); // key: phone

const CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const CODE_MAX_ATTEMPTS = 5;

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ─── Transporter ─────────────────────────────────────────────────────────────

function createTransporter(): nodemailer.Transporter {
  return nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: {
      user: config.email.user,
      pass: config.email.pass,
    },
  });
}

// ─── Email service ────────────────────────────────────────────────────────────

export class EmailService {
  // Send 6-digit code to verify email ownership (profile binding)
  async sendVerifyEmailCode(userId: string, email: string): Promise<void> {
    const code = generateCode();
    verifyEmailStore.set(userId, {
      code,
      expiresAt: Date.now() + CODE_TTL_MS,
      attempts: 0,
    });

    if (config.nodeEnv === 'development') {
      console.log(`[DEV] Email verify code for ${email}: ${code}`);
      return;
    }

    const transporter = createTransporter();
    await transporter.sendMail({
      from: `Mettig <${config.email.from}>`,
      to: email,
      subject: 'Подтверждение email — Mettig',
      text: `Ваш код подтверждения: ${code}\n\nКод действует 15 минут.`,
      html: `
        <p>Ваш код подтверждения для Mettig:</p>
        <h2 style="letter-spacing:4px">${code}</h2>
        <p>Код действует 15 минут.</p>
      `,
    });
  }

  // Verify the code for profile email binding
  checkVerifyEmailCode(userId: string, code: string): boolean {
    const entry = verifyEmailStore.get(userId);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      verifyEmailStore.delete(userId);
      return false;
    }
    entry.attempts += 1;
    if (entry.attempts > CODE_MAX_ATTEMPTS) {
      verifyEmailStore.delete(userId);
      return false;
    }
    if (entry.code !== code) return false;
    verifyEmailStore.delete(userId);
    return true;
  }

  // Send 6-digit code to verify identity during login (phone recycling protection)
  async sendLoginEmailCode(phone: string, email: string): Promise<void> {
    const code = generateCode();
    loginEmailStore.set(phone, {
      code,
      expiresAt: Date.now() + CODE_TTL_MS,
      attempts: 0,
    });

    if (config.nodeEnv === 'development') {
      console.log(`[DEV] Login email code for ${email}: ${code}`);
      return;
    }

    const transporter = createTransporter();
    await transporter.sendMail({
      from: `Mettig <${config.email.from}>`,
      to: email,
      subject: 'Вход в Mettig — подтверждение личности',
      text: `Код для входа: ${code}\n\nЕсли это не вы — проигнорируйте письмо.\n\nКод действует 15 минут.`,
      html: `
        <p>Кто-то входит в аккаунт Mettig с вашим номером телефона.</p>
        <p>Код для подтверждения:</p>
        <h2 style="letter-spacing:4px">${code}</h2>
        <p>Если это не вы — проигнорируйте письмо. Код действует 15 минут.</p>
      `,
    });
  }

  // Verify the code for login email check
  checkLoginEmailCode(phone: string, code: string): boolean {
    const entry = loginEmailStore.get(phone);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      loginEmailStore.delete(phone);
      return false;
    }
    entry.attempts += 1;
    if (entry.attempts > CODE_MAX_ATTEMPTS) {
      loginEmailStore.delete(phone);
      return false;
    }
    if (entry.code !== code) return false;
    loginEmailStore.delete(phone);
    return true;
  }
}

export const emailService = new EmailService();
