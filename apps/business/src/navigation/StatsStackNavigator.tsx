import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { Text, View } from 'react-native';
import { AnalyticsScreen } from '../screens/analytics/AnalyticsScreen';
import { ClientsScreen } from '../screens/analytics/ClientsScreen';
import { ClientCardScreen } from '../screens/analytics/ClientCardScreen';
import { ReturnRateScreen } from '../screens/analytics/ReturnRateScreen';
import type { StatsStackParamList } from './types';

const Stack = createNativeStackNavigator<StatsStackParamList>();

function BroadcastsScreenPlaceholder(): React.JSX.Element {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 17, color: '#8A8A86' }}>Рассылки (скоро)</Text>
    </View>
  );
}

export function StatsStackNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AnalyticsMain" component={AnalyticsScreen} />
      <Stack.Screen name="ClientsScreen" component={ClientsScreen} />
      <Stack.Screen name="ClientCardScreen" component={ClientCardScreen} />
      <Stack.Screen name="ReturnRateScreen" component={ReturnRateScreen} />
      <Stack.Screen name="BroadcastsScreen" component={BroadcastsScreenPlaceholder} />
    </Stack.Navigator>
  );
}
