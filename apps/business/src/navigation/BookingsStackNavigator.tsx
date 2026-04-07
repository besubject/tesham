import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { BookingsScreen } from '../screens/bookings/BookingsScreen';
import { BookingDetailsScreen } from '../screens/bookings/BookingDetailsScreen';
import { CreateSlotsScreen } from '../screens/bookings/CreateSlotsScreen';
import type { BookingsStackParamList } from './types';

const Stack = createNativeStackNavigator<BookingsStackParamList>();

export function BookingsStackNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BookingsList" component={BookingsScreen} />
      <Stack.Screen name="BookingDetails" component={BookingDetailsScreen} />
      <Stack.Screen name="CreateSlots" component={CreateSlotsScreen} />
    </Stack.Navigator>
  );
}
