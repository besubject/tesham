import { verifyEmailLogin, useAuthStore } from '@mettig/shared';
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

type Props = AuthStackScreenProps<'EmailLoginScreen'>;

export function EmailLoginScreen({ navigation, route }: Props): React.JSX.Element {
  const { phone } = route.params;
  const setAuth = useAuthStore((s) => s.setAuth);

  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRefs = useRef<Array<TextInput | null>>(Array(CODE_LENGTH).fill(null));

  useEffect(() => {
    const full = code.every((c) => c !== '');
    if (full) {
      void handleVerify(code.join(''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const handleVerify = useCallback(
    async (codeString: string) => {
      setIsVerifying(true);
      setError(null);
      try {
        const response = await verifyEmailLogin(phone, codeString);
        await setAuth(response.user, response.accessToken, response.refreshToken);

        if (!response.user.name) {
          navigation.navigate('NameScreen', {
            phone,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
          });
        }
      } catch {
        setError('Неверный код. Проверьте почту и попробуйте снова.');
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

          <Text style={styles.title}>Подтверждение личности</Text>
          <Text style={styles.subtitle}>
            Прошло больше года с вашего последнего входа.{'\n\n'}
            Мы отправили код на вашу почту, чтобы убедиться, что это вы.
          </Text>
          <Text style={styles.note}>
            Если это не вы — просто закройте приложение. Без подтверждения почты войти нельзя.
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
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  inner: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  backButton: { marginBottom: 32 },
  backText: { fontSize: 16, color: '#1D6B4F' },
  title: { fontSize: 28, fontWeight: '700', color: '#1A1A18', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#5C5C58', lineHeight: 22, marginBottom: 12 },
  note: {
    fontSize: 13,
    color: '#8A8A86',
    lineHeight: 18,
    marginBottom: 40,
    padding: 12,
    backgroundColor: '#F5F5F0',
    borderRadius: 8,
  },
  codeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
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
  codeInputFilled: { borderColor: '#1D6B4F' },
  codeInputError: { borderColor: '#C4462A' },
  errorText: { fontSize: 13, color: '#C4462A', marginBottom: 8 },
  loader: { marginVertical: 12 },
});
