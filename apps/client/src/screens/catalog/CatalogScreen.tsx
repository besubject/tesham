import React, { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, trackEvent } from '@mettig/shared';
import { BusinessList } from '../home/BusinessList';
import type { CatalogStackScreenProps } from '../../navigation/types';

type Props = CatalogStackScreenProps<'CatalogScreen'>;

export function CatalogScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    void trackEvent({ event_type: 'catalog_screen_opened' });
  }, []);

  const handleBusinessPress = useCallback(
    (businessId: string) => {
      navigation.navigate('BusinessDetails', { businessId });
    },
    [navigation],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <BusinessList
        showSortToggle
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
});
