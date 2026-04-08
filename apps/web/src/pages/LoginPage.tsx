import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendCode, verifyCode, useAuthStore } from '@mettig/shared';
import './LoginPage.css';

type Step = 'phone' | 'code';

function LoginPage(): React.JSX.Element {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    let cleaned = raw;
    if (cleaned.startsWith('7') || cleaned.startsWith('8')) {
      cleaned = cleaned.slice(1);
    }
    const next = cleaned.slice(0, 10);
    setPhone(next);
    if (error) setError(null);
  };

  const formatPhoneDisplay = (digits: string): string => {
    const d = digits.padEnd(10, '_');
    return `+7 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8, 10)}`;
  };

  const isPhoneValid = (digits: string): boolean => digits.length === 10;
  const isCodeValid = (c: string): boolean => c.length === 6;

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPhoneValid(phone)) {
      setError('Введите корректный номер телефона');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await sendCode(`+7${phone}`);
      setStep('code');
    } catch (err) {
      setError('Не удалось отправить код. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCodeValid(code)) {
      setError('Введите 6-значный код');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await verifyCode(`+7${phone}`, code);
      await setAuth(response.user, response.accessToken, response.refreshToken);
      navigate('/bookings');
    } catch (err) {
      setError('Неверный код. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1 className="login-title">Mettig Business</h1>
          <p className="login-subtitle">Вход в кабинет мастера</p>
        </div>

        {step === 'phone' ? (
          <form onSubmit={handleSendCode} className="login-form">
            <div className="form-group">
              <label htmlFor="phone" className="form-label">
                Номер телефона
              </label>
              <div className="phone-input-wrapper">
                <span className="phone-prefix">+7</span>
                <input
                  id="phone"
                  type="tel"
                  value={formatPhoneDisplay(phone)}
                  onChange={handlePhoneChange}
                  placeholder="(9XX) XXX-XX-XX"
                  className="form-input phone-input"
                  autoFocus
                  disabled={loading}
                />
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            <button
              type="submit"
              className="submit-btn"
              disabled={!isPhoneValid(phone) || loading}
            >
              {loading ? 'Отправляю...' : 'Отправить код'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="login-form">
            <div className="form-group">
              <label htmlFor="code" className="form-label">
                Код подтверждения
              </label>
              <p className="form-hint">Код отправлен на номер {`+7${phone}`}</p>
              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setCode(cleaned);
                  if (error) setError(null);
                }}
                placeholder="000000"
                className="form-input code-input"
                maxLength={6}
                autoFocus
                disabled={loading}
                inputMode="numeric"
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button
              type="submit"
              className="submit-btn"
              disabled={!isCodeValid(code) || loading}
            >
              {loading ? 'Проверяю...' : 'Подтвердить'}
            </button>

            <button
              type="button"
              className="back-btn"
              onClick={() => {
                setStep('phone');
                setCode('');
                setError(null);
              }}
              disabled={loading}
            >
              Вернуться к номеру телефона
            </button>
          </form>
        )}

        <div className="login-footer">
          <p className="footer-text">Это кабинет для мастеров и администраторов</p>
          <p className="footer-text">Для клиентов используйте мобильное приложение</p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
