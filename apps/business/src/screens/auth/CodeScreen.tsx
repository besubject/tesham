import { sendCode, verifyCode, useAuthStore } from '@mettig/shared';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  NativeSyntheticEvent,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AuthStackScreenProps } from '../../navigation/types';

const CODE_LENGTH = 6;
const RESEND_TIMEOUT = 60;

type Props = AuthStackScreenProps<'CodeScreen'>;

export function CodeScreen({ navigation, route }: Props): React.JSX.Element {
  const { phone } = route.params;
  const setAuth = useAuthStore((s) => s.setAuth);

  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_TIMEOUT);

  const inputRefs = useRef<Array<TextInput | null>>(Array(CODE_LENGTH).fill(null));

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  useEffect(() => {
    const full = code.every((c) => c !== '');
    if (full) {
      void handleVerify(code.join(''));
    }
  }, [code]);

  const handleVerify = useCallback(
    async (codeString: string) => {
      setIsVerifying(true);
      setError(null);
      try {
        const response = await verifyCode(phone, codeString);

        if (response.requiresEmailVerification) {
          setError('Требуется подтверждение по email. Обратитесь в поддержку.');
          setCode(Array(CODE_LENGTH).fill(''));
          return;
        }

        if (!response.user.name.trim()) {
          navigation.navigate('NameScreen', {
            phone,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
          });
          return;
        }

        await setAuth(response.user, response.accessToken, response.refreshToken);
      } catch (err: unknown) {
        const axiosErr = err as {
          response?: { data?: { error?: { message?: string } }; status?: number };
        };
        const serverMsg = axiosErr?.response?.data?.error?.message;
        const status = axiosErr?.response?.status;

        if (status === 429) {
          setError('Слишком много попыток. Попробуйте через 10 минут.');
        } else if (
          status === 401 ||
          serverMsg?.toLowerCase().includes('invalid') ||
          serverMsg?.toLowerCase().includes('expired')
        ) {
          setError('Неверный или устаревший код. Попробуйте ещё раз.');
        } else {
          setError('Ошибка при проверке кода. Попробуйте снова.');
        }

        setCode(Array(CODE_LENGTH).fill(''));
        requestAnimationFrame(() => {
          inputRefs.current[0]?.focus();
        });
      } finally {
        setIsVerifying(false);
      }
    },
    [phone, navigation, setAuth],
  );

  const handleChangeAt = useCallback(
    (index: number, value: string) => {
      const digit = value.replace(/\D/g, '').slice(-1);
      const next = [...code];
      next[index] = digit;
      setCode(next);
      if (error) setError(null);

      if (digit && index < CODE_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [code, error],
  );

  const handleKeyPress = useCallback(
    (index: number, e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
        const next = [...code];
        next[index - 1] = '';
        setCode(next);
      }
    },
    [code],
  );

  const handleResend = useCallback(async () => {
    if (secondsLeft > 0 || isResending) return;
    setIsResending(true);
    setError(null);
    try {
      await sendCode(phone);
      setSecondsLeft(RESEND_TIMEOUT);
      setCode(Array(CODE_LENGTH).fill(''));
      requestAnimationFrame(() => {
        inputRefs.current[0]?.focus();
      });
    } catch {
      setError('Не удалось отправить код. Попробуйте снова.');
    } finally {
      setIsResending(false);
    }
  }, [phone, secondsLeft, isResending]);

  const displayPhone = phone.replace(/(\+7)(\d{3})(\d{3})(\d{2})(\d{2})/, '$1 ($2) $3-$4-$5');

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            accessibilityLabel="Назад"
          >
            <Text style={styles.backText}>← Назад</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Введите код</Text>
          <Text style={styles.subtitle}>
            Мы отправили SMS с кодом на{'\n'}
            <Text style={styles.phoneHighlight}>{displayPhone}</Text>
          </Text>

          <View style={styles.codeRow}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                style={[
                  styles.codeInput,
                  digit ? styles.codeInputFilled : null,
                  error ? styles.codeInputError : null,
                ]}
                value={digit}
                onChangeText={(v) => handleChangeAt(index, v)}
                onKeyPress={(e) => handleKeyPress(index, e)}
                keyboardType="number-pad"
                maxLength={1}
                editable={!isVerifying}
                selectTextOnFocus
                accessibilityLabel={`Цифра ${index + 1} из ${CODE_LENGTH}`}
                autoFocus={index === 0}
              />
            ))}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {isVerifying ? <ActivityIndicator style={styles.loader} color="#1D6B4F" /> : null}

          <View style={styles.resendWrapper}>
            {secondsLeft > 0 ? (
              <Text style={styles.resendTimer}>Повторная отправка через {secondsLeft} сек</Text>
            ) : (
              <TouchableOpacity
                onPress={handleResend}
                disabled={isResending}
                accessibilityLabel="Отправить код повторно"
              >
                {isResending ? (
                  <ActivityIndicator color="#1D6B4F" />
                ) : (
                  <Text style={styles.resendLink}>Отправить код повторно</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  inner: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  backButton: {
    marginBottom: 32,
  },
  backText: {
    fontSize: 16,
    color: '#1D6B4F',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A18',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#5C5C58',
    lineHeight: 22,
    marginBottom: 40,
  },
  phoneHighlight: {
    color: '#1A1A18',
    fontWeight: '600',
  },
  codeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  codeInput: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E8E8E4',
    borderRadius: 12,
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A18',
    textAlign: 'center',
  },
  codeInputFilled: {
    borderColor: '#1D6B4F',
  },
  codeInputError: {
    borderColor: '#C4462A',
  },
  errorText: {
    fontSize: 13,
    color: '#C4462A',
    marginBottom: 8,
  },
  loader: {
    marginVertical: 12,
  },
  resendWrapper: {
    marginTop: 24,
    alignItems: 'center',
  },
  resendTimer: {
    fontSize: 14,
    color: '#8A8A86',
  },
  resendLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1D6B4F',
  },
});
