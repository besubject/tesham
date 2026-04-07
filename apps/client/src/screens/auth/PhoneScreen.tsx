import { sendCode } from '@mettig/shared';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AuthStackScreenProps } from '../../navigation/types';

type Props = AuthStackScreenProps<'PhoneScreen'>;

function formatPhoneDisplay(digits: string): string {
  // digits is only the 10 digits after +7
  const d = digits.padEnd(10, '_');
  return `+7 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8, 10)}`;
}

function isPhoneValid(digits: string): boolean {
  return digits.length === 10;
}

export function PhoneScreen({ navigation }: Props): React.JSX.Element {
  const [digits, setDigits] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const handleChangeText = useCallback((text: string) => {
    // Strip everything except digits
    const raw = text.replace(/\D/g, '');
    // If user typed starting with 8 or 7, drop the leading digit
    let cleaned = raw;
    if (cleaned.startsWith('7') || cleaned.startsWith('8')) {
      cleaned = cleaned.slice(1);
    }
    // Keep only up to 10 digits
    const next = cleaned.slice(0, 10);
    setDigits(next);
    if (error) setError(null);
  }, [error]);

  const handleSendCode = useCallback(async () => {
    if (!isPhoneValid(digits)) {
      setError('Введите корректный номер телефона');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const phone = `+7${digits}`;
      await sendCode(phone);
      navigation.navigate('CodeScreen', { phone });
    } catch {
      setError('Не удалось отправить код. Попробуйте снова.');
    } finally {
      setIsLoading(false);
    }
  }, [digits, navigation]);

  const valid = isPhoneValid(digits);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Вход в Mettig</Text>
          <Text style={styles.subtitle}>Введите номер телефона, и мы отправим вам код подтверждения</Text>

          <View style={styles.fieldWrapper}>
            <Text style={styles.label}>Номер телефона</Text>
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => inputRef.current?.focus()}
              style={[styles.phoneBox, error ? styles.phoneBoxError : null]}
              accessibilityLabel="Поле ввода номера телефона"
            >
              <Text style={[styles.phoneText, digits.length === 0 && styles.phonePlaceholder]}>
                {digits.length === 0 ? '+7 (XXX) XXX-XX-XX' : formatPhoneDisplay(digits)}
              </Text>
            </TouchableOpacity>
            <TextInput
              ref={inputRef}
              value={digits}
              onChangeText={handleChangeText}
              keyboardType="phone-pad"
              maxLength={15}
              style={styles.hiddenInput}
              accessibilityLabel="Скрытый ввод номера телефона"
              caretHidden
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>

          <TouchableOpacity
            style={[styles.button, (!valid || isLoading) && styles.buttonDisabled]}
            onPress={handleSendCode}
            disabled={!valid || isLoading}
            accessibilityLabel="Получить код подтверждения"
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Получить код</Text>
            )}
          </TouchableOpacity>
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
    paddingTop: 48,
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
  fieldWrapper: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#5C5C58',
    marginBottom: 8,
  },
  phoneBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E4',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  phoneBoxError: {
    borderColor: '#C4462A',
  },
  phoneText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1A1A18',
    letterSpacing: 1,
  },
  phonePlaceholder: {
    color: '#8A8A86',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  errorText: {
    marginTop: 6,
    fontSize: 13,
    color: '#C4462A',
  },
  button: {
    backgroundColor: '#1D6B4F',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
