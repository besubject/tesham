import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { BookingsScreen } from '../screens/bookings/BookingsScreen';
import type { BookingsStackParamList } from './types';

const Stack = createNativeStackNavigator<BookingsStackParamList>();

export function BookingsStackNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BookingsList" component={BookingsScreen} />
    </Stack.Navigator>
  );
}
