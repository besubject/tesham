import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { HomeTabScreenProps } from '../../navigation/types';

type Props = HomeTabScreenProps<'Map'>;

export function MapScreen(_props: Props): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Карта</Text>
      <Text style={styles.subtitle}>Бизнесы на карте</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
});
