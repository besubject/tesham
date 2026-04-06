import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { HomeScreen } from '../screens/home/HomeScreen';
import type { HomeStackParamList } from './types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStackNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeScreen" component={HomeScreen} />
    </Stack.Navigator>
  );
}
