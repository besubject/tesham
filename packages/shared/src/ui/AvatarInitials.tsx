import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { borderRadius, colors, typography } from './theme';

interface AvatarInitialsProps {
  name: string;
  avatarUrl?: string | null;
  size?: number;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return ((parts[0][0] ?? '') + (parts[1][0] ?? '')).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function AvatarInitials({ name, avatarUrl, size = 44 }: AvatarInitialsProps): React.JSX.Element {
  const style = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[styles.avatar, style]}
        accessibilityLabel={name}
      />
    );
  }

  return (
    <View style={[styles.placeholder, style]}>
      <Text style={[styles.initials, { fontSize: size * 0.35 }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: colors.surfaceAlt,
  },
  placeholder: {
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    ...typography.label,
    color: colors.accent,
    fontWeight: '600',
  },
});
