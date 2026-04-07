import React, { useRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { borderRadius, colors, spacing, typography } from './theme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
  autoFocus?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Поиск...',
  onClear,
  autoFocus,
  onFocus,
  onBlur,
}: SearchBarProps): React.JSX.Element {
  const inputRef = useRef<TextInput>(null);

  return (
    <View style={styles.container}>
      <Text style={styles.searchIcon}>🔍</Text>
      <TextInput
        ref={inputRef}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoFocus={autoFocus}
        onFocus={onFocus}
        onBlur={onBlur}
        returnKeyType="search"
        clearButtonMode="never"
        accessibilityLabel="Поиск"
      />
      {value.length > 0 && (
        <TouchableOpacity
          onPress={() => {
            onChangeText('');
            onClear?.();
            inputRef.current?.focus();
          }}
          style={styles.clearButton}
          accessibilityLabel="Очистить поиск"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.clearIcon}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    gap: spacing.sm,
  },
  searchIcon: {
    fontSize: 16,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    padding: 0,
  },
  clearButton: {
    padding: spacing.xs,
  },
  clearIcon: {
    fontSize: 14,
    color: colors.textMuted,
  },
});
