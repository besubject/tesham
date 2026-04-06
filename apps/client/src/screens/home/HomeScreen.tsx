import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { HomeStackScreenProps } from '../../navigation/types';

type Props = HomeStackScreenProps<'HomeScreen'>;

export function HomeScreen({ navigation }: Props): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mettig</Text>
      <Text style={styles.subtitle}>Найдите мастера рядом</Text>
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
    fontSize: 32,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
});
