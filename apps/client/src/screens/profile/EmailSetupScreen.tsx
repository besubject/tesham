import { setEmail, verifyUserEmail } from '@mettig/shared';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { colors, typography, spacing, borderRadius } from '@mettig/shared';
import type { ProfileStackScreenProps } from '../../navigation/types';

const CODE_LENGTH = 6;

type Props = ProfileStackScreenProps<'EmailSetup'>;

type Step = 'enter_email' | 'enter_code';

export function EmailSetupScreen({ navigation }: Props): React.JSX.Element {
  const [step, setStep] = useState<Step>('enter_email');
  const [email, setEmailValue] = useState('');
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRefs = useRef<Array<TextInput | null>>(Array(CODE_LENGTH).fill(null));

  const handleSendCode = useCallback(async () => {
    if (!email.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      await setEmail(email.trim().toLowerCase());
      setStep('enter_code');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      setError(msg.includes('409') ? 'Этот email уже привязан к другому аккаунту' : 'Не удалось отправить код. Попробуйте снова.');
    } finally {
      setIsLoading(false);
    }
  }, [email]);

  const handleVerifyCode = useCallback(
    async (codeString: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await verifyUserEmail(codeString);
        Alert.alert('Готово', 'Email подтверждён и привязан к аккаунту.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } catch {
        setError('Неверный или устаревший код.');
        setCode(Array(CODE_LENGTH).fill(''));
        requestAnimationFrame(() => inputRefs.current[0]?.focus());
      } finally {
        setIsLoading(false);
      }
    },
    [navigation],
  );

  const handleCodeChange = useCallback(
    (index: number, value: string) => {
      const digit = value.replace(/\D/g, '').slice(-1);
      const next = [...code];
      next[index] = digit;
      setCode(next);
      if (error) setError(null);
      if (digit && index < CODE_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
      if (next.every((c) => c !== '')) {
        void handleVerifyCode(next.join(''));
      }
    },
    [code, error, handleVerifyCode],
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

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backText}>← Назад</Text>
          </TouchableOpacity>

          {step === 'enter_email' ? (
            <>
              <Text style={styles.title}>Привязать email</Text>
              <Text style={styles.subtitle}>
                Email защищает ваш аккаунт: если номер телефона перейдёт другому человеку, без
                вашей почты войти не получится.
              </Text>

              <TextInput
                style={styles.emailInput}
                value={email}
                onChangeText={setEmailValue}
                placeholder="your@email.com"
                placeholderTextColor={colors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.button, (!email.trim() || isLoading) && styles.buttonDisabled]}
                onPress={handleSendCode}
                disabled={!email.trim() || isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Отправить код</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.title}>Введите код</Text>
              <Text style={styles.subtitle}>
                Мы отправили 6-значный код на{'\n'}
                <Text style={styles.emailHighlight}>{email}</Text>
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
                    onChangeText={(v) => handleCodeChange(index, v)}
                    onKeyPress={(e) => handleKeyPress(index, e)}
                    keyboardType="number-pad"
                    maxLength={1}
                    editable={!isLoading}
                    selectTextOnFocus
                    autoFocus={index === 0}
                  />
                ))}
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              {isLoading ? <ActivityIndicator style={styles.loader} color={colors.accent} /> : null}

              <TouchableOpacity onPress={() => setStep('enter_email')} style={styles.changeEmail}>
                <Text style={styles.changeEmailText}>Изменить email</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1 },
  content: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  backButton: { marginBottom: 32 },
  backText: { fontSize: 16, color: colors.accent },
  title: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: 8 },
  subtitle: { fontSize: 15, color: colors.textSecondary, lineHeight: 22, marginBottom: 32 },
  emailHighlight: { color: colors.text, fontWeight: '600' },
  emailInput: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
    marginBottom: 16,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { ...typography.button, color: '#FFFFFF' },
  codeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  codeInput: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  codeInputFilled: { borderColor: colors.accent },
  codeInputError: { borderColor: colors.coral },
  errorText: { fontSize: 13, color: colors.coral, marginBottom: 8 },
  loader: { marginVertical: 12 },
  changeEmail: { marginTop: 24, alignItems: 'center' },
  changeEmailText: { fontSize: 14, color: colors.accent, fontWeight: '600' },
});
