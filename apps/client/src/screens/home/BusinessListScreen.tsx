import React, { useCallback } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '@mettig/shared';
import { BusinessList } from './BusinessList';
import type { HomeStackScreenProps } from '../../navigation/types';

type Props = HomeStackScreenProps<'BusinessList'>;

export function BusinessListScreen({ navigation, route }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { categoryId, categoryName } = route.params;

  const handleBusinessPress = useCallback(
    (businessId: string) => {
      navigation.navigate('BusinessDetails', { businessId });
    },
    [navigation],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{categoryName}</Text>
        <View style={styles.backButton} />
      </View>

      {/* Business list filtered by category */}
      <BusinessList
        categoryId={categoryId}
        showSortToggle={false}
        onBusinessPress={handleBusinessPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 22,
    color: colors.text,
  },
  title: {
    flex: 1,
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
  },
});
