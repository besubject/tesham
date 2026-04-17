import { apiClient, useAuthStore } from '@mettig/shared';
import type { UserDto } from '@mettig/shared';
import React, { useCallback, useState } from 'react';
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

type Props = AuthStackScreenProps<'NameScreen'>;

export function NameScreen({ route }: Props): React.JSX.Element {
  const { accessToken, refreshToken } = route.params;
  const setAuth = useAuthStore((s) => s.setAuth);

  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Пожалуйста, введите ваше имя');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.patch<UserDto>(
        '/user/me',
        { name: trimmed },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      await setAuth(data, accessToken, refreshToken);
    } catch {
      setError('Не удалось сохранить имя. Попробуйте снова.');
    } finally {
      setIsLoading(false);
    }
  }, [name, accessToken, refreshToken, setAuth]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Как вас зовут?</Text>
          <Text style={styles.subtitle}>
            Это имя будет отображаться в профиле заведения
          </Text>

          <View style={styles.fieldWrapper}>
            <Text style={styles.label}>Ваше имя</Text>
            <TextInput
              style={[styles.input, error ? styles.inputError : null]}
              value={name}
              onChangeText={(v) => {
                setName(v);
                if (error) setError(null);
              }}
              placeholder="Как вас зовут?"
              placeholderTextColor="#8A8A86"
              autoFocus
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleSave}
              accessibilityLabel="Поле ввода имени"
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>

          <TouchableOpacity
            style={[styles.button, (!name.trim() || isLoading) && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={!name.trim() || isLoading}
            accessibilityLabel="Продолжить"
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Продолжить</Text>
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
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E4',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1A1A18',
  },
  inputError: {
    borderColor: '#C4462A',
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
