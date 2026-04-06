import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { StatsScreen } from '../screens/stats/StatsScreen';
import type { StatsStackParamList } from './types';

const Stack = createNativeStackNavigator<StatsStackParamList>();

export function StatsStackNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="StatsMain" component={StatsScreen} />
    </Stack.Navigator>
  );
}
