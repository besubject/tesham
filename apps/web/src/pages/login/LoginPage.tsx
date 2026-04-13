import React, { useState } from 'react';
import { Alert, Box, Button, Input, Paper, PinInput, Stack, Text, Title } from '@mantine/core';
import { IMaskInput } from 'react-imask';
import { useNavigate } from 'react-router-dom';
import { sendCode, useAuthStore, verifyCode } from '@mettig/shared';
import { Step } from 'src/types';
import { PHONE_MASK } from 'src/constants';

function getPhoneDigits(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('7') ? digits.slice(1) : digits;
}

function LoginPage(): React.JSX.Element {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phoneDigits = getPhoneDigits(phone);
  const isPhoneValid = phoneDigits.length === 10;
  const isCodeValid = code.length === 6;
  const isPhoneStep = step === 'phone';

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPhoneValid) {
      setError('Введите корректный номер телефона');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await sendCode(`+7${phoneDigits}`);
      setStep('code');
    } catch {
      setError('Не удалось отправить код. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCodeValid) {
      setError('Введите 6-значный код');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await verifyCode(`+7${phoneDigits}`, code);
      if (response.requiresEmailVerification) {
        setError('Для этого аккаунта нужен вход через подтверждение email.');
        return;
      }
      await setAuth(response.user, response.accessToken, response.refreshToken);
      navigate('/bookings');
    } catch {
      setError('Неверный код. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'linear-gradient(135deg, rgba(26, 27, 30, 1) 0%, rgba(18, 86, 67, 1) 100%)',
      }}
    >
      <Paper radius="xl" shadow="xl" p={40} w="100%" maw={440} withBorder>
        <Stack gap="xl">
          <Stack gap={6} ta="center">
            <Title order={1}>Tesham Business</Title>
            <Text c="dimmed" size="sm">
              Вход в кабинет мастера
            </Text>
          </Stack>

          <form onSubmit={isPhoneStep ? handleSendCode : handleVerifyCode}>
            <Stack gap="md">
              {isPhoneStep ? (
                <Input
                  component={IMaskInput}
                  mask={PHONE_MASK}
                  label="Номер телефона"
                  placeholder="+7 (___) ___-__-__"
                  value={phone}
                  onAccept={(value: unknown) => {
                    setPhone(String(value));
                    if (error) setError(null);
                  }}
                  disabled={loading}
                  size="md"
                  autoFocus
                  inputMode="tel"
                  required
                />
              ) : (
                <>
                  <Text size="sm" fw={500}>
                    Код подтверждения
                  </Text>
                  <Text size="sm" c="dimmed">
                    Код отправлен на номер {`+7${phoneDigits}`}
                  </Text>
                  <PinInput
                    length={6}
                    oneTimeCode
                    type="number"
                    autoFocus
                    value={code}
                    onChange={(value: string) => {
                      setCode(value);
                      if (error) setError(null);
                    }}
                    disabled={loading}
                    size="md"
                  />
                </>
              )}

              {error ? (
                <Alert color="red" variant="light">
                  {error}
                </Alert>
              ) : null}

              <Button
                type="submit"
                fullWidth
                size="md"
                loading={loading}
                disabled={isPhoneStep ? !isPhoneValid : !isCodeValid}
              >
                {isPhoneStep ? 'Отправить код' : 'Подтвердить'}
              </Button>

              {step === 'code' ? (
                <Button
                  type="button"
                  variant="subtle"
                  color="gray"
                  size="sm"
                  onClick={() => {
                    setStep('phone');
                    setCode('');
                    setError(null);
                  }}
                  disabled={loading}
                  styles={{ root: { alignSelf: 'center' } }}
                >
                  Вернуться к номеру телефона
                </Button>
              ) : null}
            </Stack>
          </form>

          <Stack gap={4} pt="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
            <Text size="xs" c="dimmed" ta="center">
              Это кабинет для мастеров и администраторов
            </Text>
            <Text size="xs" c="dimmed" ta="center">
              Для клиентов используйте мобильное приложение
            </Text>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}

export default LoginPage;
