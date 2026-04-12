import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { borderRadius, colors, spacing, typography } from './theme';

interface CategoryChipProps {
  label: string;
  icon?: string;
  selected?: boolean;
  onPress?: () => void;
}

export function CategoryChip({ label, icon, selected = false, onPress }: CategoryChipProps): React.JSX.Element {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {/* {icon ? <Text style={styles.icon}>{icon}</Text> : null} */}
      <Text style={[styles.text, selected && styles.textSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  icon: {
    fontSize: 14,
  },
  text: {
    ...typography.label,
    color: colors.text,
  },
  textSelected: {
    color: colors.white,
  },
});
