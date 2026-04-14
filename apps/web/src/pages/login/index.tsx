import React, { FormEvent, useState } from 'react';
import { Alert, Box, Button, Input, Paper, PinInput, Stack, Text, Title } from '@mantine/core';
import { IMaskInput } from 'react-imask';
import { useNavigate } from 'react-router-dom';
import { sendCode, useAuthStore, verifyCode } from '@mettig/shared';
import { PHONE_MASK } from 'src/constants';
import {
  LOGIN_PAGE_COPY,
  LOGIN_STEP_ACTION_LABELS,
  VALID_CODE_LENGTH,
  VALID_PHONE_LENGTH,
} from './constants';
import { Step } from './types';
import { getPhoneDigits } from './utils';

export const LoginPage = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phoneDigits = getPhoneDigits(phone);
  const isPhoneValid = phoneDigits.length === VALID_PHONE_LENGTH;
  const isCodeValid = code.length === VALID_CODE_LENGTH;
  const isPhoneStep = step === 'phone';

  const {
    invalidPhone,
    sendCodeError,
    backToPhone,
    clientHint,
    codeTitle,
    invalidCode,
    phoneLabel,
    phonePlaceholder,
    staffCabinet,
    verifyWithEmail,
    subtitle,
    title,
    verifyCodeError,
  } = LOGIN_PAGE_COPY;

  const handleSendCode = async () => {
    if (!isPhoneValid) {
      setError(invalidPhone);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await sendCode(`+7${phoneDigits}`);
      setStep('code');
    } catch {
      setError(sendCodeError);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!isCodeValid) {
      setError(invalidCode);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await verifyCode(`+7${phoneDigits}`, code);
      if (response.requiresEmailVerification) {
        setError(verifyWithEmail);
        return;
      }
      await setAuth(response.user, response.accessToken, response.refreshToken);
      navigate('/bookings');
    } catch {
      setError(verifyCodeError);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (isPhoneStep) {
      handleSendCode();

      return;
    }

    handleVerifyCode();
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
            <Title order={1}>{title}</Title>
            <Text c="dimmed" size="sm">
              {subtitle}
            </Text>
          </Stack>

          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              {isPhoneStep ? (
                <Input
                  component={IMaskInput}
                  mask={PHONE_MASK}
                  label={phoneLabel}
                  placeholder={phonePlaceholder}
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
                    {codeTitle}
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
                {LOGIN_STEP_ACTION_LABELS[step]}
              </Button>

              {!isPhoneStep ? (
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
                  {backToPhone}
                </Button>
              ) : null}
            </Stack>
          </form>

          <Stack gap={4} pt="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
            <Text size="xs" c="dimmed" ta="center">
              {staffCabinet}
            </Text>
            <Text size="xs" c="dimmed" ta="center">
              {clientHint}
            </Text>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
};
