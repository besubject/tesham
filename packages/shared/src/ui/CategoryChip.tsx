import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { resolveCategoryIcon } from '../utils';
import { borderRadius, colors, spacing, typography } from './theme';

interface CategoryChipProps {
  label: string;
  icon?: string;
  selected?: boolean;
  onPress?: () => void;
}

export function CategoryChip({ label, icon, selected = false, onPress }: CategoryChipProps): React.JSX.Element {
  const resolvedIcon = resolveCategoryIcon(icon);

  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {resolvedIcon ? <Text style={styles.icon}>{resolvedIcon}</Text> : null}
      <Text style={[styles.text, selected && styles.textSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 38,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  icon: {
    fontSize: 14,
    lineHeight: 16,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  text: {
    ...typography.label,
    color: colors.text,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  textSelected: {
    color: colors.white,
  },
});
