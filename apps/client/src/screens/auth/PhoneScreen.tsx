import { sendCode } from '@mettig/shared';
import { colors, monoFont } from '@mettig/shared';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AuthStackScreenProps } from '../../navigation/types';

type Props = AuthStackScreenProps<'PhoneScreen'>;

function formatPhoneDisplay(digits: string): string {
  const d = digits.padEnd(10, '_');
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8, 10)}`;
}

function isPhoneValid(digits: string): boolean {
  return digits.length === 10;
}

export function PhoneScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [digits, setDigits] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const handleChangeText = useCallback((text: string) => {
    const raw = text.replace(/\D/g, '');
    let cleaned = raw;
    if (cleaned.startsWith('7') || cleaned.startsWith('8')) {
      cleaned = cleaned.slice(1);
    }
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* ── Brand mark ──────────────────────────────────── */}
        <View style={styles.brandRow}>
          <View style={styles.brandDot} />
          <Text style={styles.brandLabel}>Tesham · v 0.1</Text>
        </View>

        {/* ── Hero title ──────────────────────────────────── */}
        <Text style={styles.heroTitle}>{'Всё рядом.\nЗа одну минуту.'}</Text>
        <Text style={styles.heroSub}>
          Введите номер телефона — отправим SMS с кодом. Без паролей.
        </Text>

        {/* ── Phone field ─────────────────────────────────── */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Номер телефона</Text>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => inputRef.current?.focus()}
            style={[styles.phoneCard, error != null && styles.phoneCardError]}
            accessibilityLabel="Поле ввода номера телефона"
          >
            <View style={styles.prefixBox}>
              <Text style={styles.prefixText}>+7</Text>
            </View>
            <View style={styles.phoneSep} />
            <Text style={[styles.phoneDigits, digits.length === 0 && styles.phoneMuted]}>
              {digits.length === 0 ? '___ ___ ____' : formatPhoneDisplay(digits)}
            </Text>
            <Text style={styles.phoneCountry}>RU</Text>
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
          {error != null && <Text style={styles.errorText}>{error}</Text>}
          <Text style={styles.legalText}>
            Продолжая, вы соглашаетесь с{' '}
            <Text style={styles.legalLink}>условиями</Text>
            {' '}и{' '}
            <Text style={styles.legalLink}>политикой</Text>.
          </Text>
        </View>

        {/* ── CTA ─────────────────────────────────────────── */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
          <Pressable
            style={[styles.primaryBtn, (!valid || isLoading) && styles.primaryBtnDisabled]}
            onPress={() => void handleSendCode()}
            disabled={!valid || isLoading}
            accessibilityLabel="Получить код подтверждения"
          >
            {isLoading ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={styles.primaryBtnText}>Получить код</Text>
            )}
          </Pressable>
          <TouchableOpacity
            onPress={() => navigation.navigate('EmailLoginScreen', { phone: digits ? `7${digits}` : '' })}
            style={styles.emailLink}
            activeOpacity={0.7}
          >
            <Text style={styles.emailLinkText}>Войти по email</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 18,
  },
  // Brand
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 32,
    marginBottom: 18,
  },
  brandDot: {
    width: 10,
    height: 10,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  brandLabel: {
    fontFamily: monoFont,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  // Hero
  heroTitle: {
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -1.4,
    lineHeight: 44,
    color: colors.text,
    marginBottom: 12,
  },
  heroSub: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 21,
    maxWidth: 280,
    marginBottom: 36,
  },
  // Phone field
  fieldBlock: {
    flex: 1,
  },
  fieldLabel: {
    fontFamily: monoFont,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 8,
  },
  phoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    overflow: 'hidden',
  },
  phoneCardError: {
    borderColor: colors.coral,
  },
  prefixBox: {
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  prefixText: {
    fontFamily: monoFont,
    fontSize: 14,
    color: colors.text,
  },
  phoneSep: {
    width: 1,
    height: '100%',
    backgroundColor: colors.border,
  },
  phoneDigits: {
    flex: 1,
    fontFamily: monoFont,
    fontSize: 18,
    color: colors.text,
    letterSpacing: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  phoneMuted: {
    color: colors.textMuted,
  },
  phoneCountry: {
    fontFamily: monoFont,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.textMuted,
    paddingRight: 16,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  errorText: {
    marginTop: 6,
    fontFamily: monoFont,
    fontSize: 11,
    color: colors.coral,
  },
  legalText: {
    marginTop: 10,
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 17,
  },
  legalLink: {
    color: colors.text,
    textDecorationLine: 'underline',
  },
  // CTA
  footer: {
    paddingTop: 12,
  },
  primaryBtn: {
    backgroundColor: colors.text,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.45,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.surface,
  },
  emailLink: {
    marginTop: 12,
    alignItems: 'center',
  },
  emailLinkText: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
