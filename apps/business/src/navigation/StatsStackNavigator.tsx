import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { Text, View } from 'react-native';
import { AnalyticsScreen } from '../screens/analytics/AnalyticsScreen';
import type { StatsStackParamList } from './types';

const Stack = createNativeStackNavigator<StatsStackParamList>();

function ClientsScreenPlaceholder(): React.JSX.Element {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Клиенты (coming soon)</Text>
    </View>
  );
}

export function StatsStackNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AnalyticsMain" component={AnalyticsScreen} />
      <Stack.Screen name="ClientsScreen" component={ClientsScreenPlaceholder} />
    </Stack.Navigator>
  );
}
