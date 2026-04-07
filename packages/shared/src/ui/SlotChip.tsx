import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { borderRadius, colors, spacing, typography } from './theme';

interface SlotChipProps {
  time: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}

export function SlotChip({ time, selected = false, onPress, disabled = false }: SlotChipProps): React.JSX.Element {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        selected && styles.chipSelected,
        disabled && styles.chipDisabled,
      ]}
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={0.7}
      accessibilityLabel={`Слот ${time}`}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
    >
      <Text
        style={[
          styles.text,
          selected && styles.textSelected,
          disabled && styles.textDisabled,
        ]}
      >
        {time}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipDisabled: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    opacity: 0.5,
  },
  text: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '500',
  },
  textSelected: {
    color: colors.white,
  },
  textDisabled: {
    color: colors.textMuted,
  },
});
