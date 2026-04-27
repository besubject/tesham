import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { AnalyticsScreen } from '../screens/analytics/AnalyticsScreen';
import { BroadcastsScreen } from '../screens/analytics/BroadcastsScreen';
import { ClientCardScreen } from '../screens/analytics/ClientCardScreen';
import { ClientsScreen } from '../screens/analytics/ClientsScreen';
import { ReturnRateScreen } from '../screens/analytics/ReturnRateScreen';
import type { StatsStackParamList } from './types';

const Stack = createNativeStackNavigator<StatsStackParamList>();

export function StatsStackNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AnalyticsMain" component={AnalyticsScreen} />
      <Stack.Screen name="ClientsScreen" component={ClientsScreen} />
      <Stack.Screen name="ClientCardScreen" component={ClientCardScreen} />
      <Stack.Screen name="ReturnRateScreen" component={ReturnRateScreen} />
      <Stack.Screen name="BroadcastsScreen" component={BroadcastsScreen} />
    </Stack.Navigator>
  );
}
