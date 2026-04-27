import React, { useCallback } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, monoFont } from '@mettig/shared';
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
      {/* B-style header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.categoryTitle}>{categoryName}</Text>
          <Text style={styles.subLabel}>· сейчас</Text>
        </View>
      </View>

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
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 20,
    color: colors.text,
    lineHeight: 22,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  categoryTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.8,
    color: colors.text,
    lineHeight: 32,
  },
  subLabel: {
    fontFamily: monoFont,
    fontSize: 11,
    color: colors.accent,
    letterSpacing: 0.4,
  },
});
