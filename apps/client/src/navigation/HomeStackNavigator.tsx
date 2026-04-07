import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { BookingConfirmScreen } from '../screens/home/BookingConfirmScreen';
import { BookingSlotsScreen } from '../screens/home/BookingSlotsScreen';
import { BusinessDetailsScreen } from '../screens/home/BusinessDetailsScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import type { HomeStackParamList } from './types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStackNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeScreen" component={HomeScreen} />
      <Stack.Screen name="BusinessDetails" component={BusinessDetailsScreen} />
      <Stack.Screen name="BookingSlots" component={BookingSlotsScreen} />
      <Stack.Screen name="BookingConfirm" component={BookingConfirmScreen} />
    </Stack.Navigator>
  );
}
