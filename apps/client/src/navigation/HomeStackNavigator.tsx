import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { BookingConfirmScreen } from '../screens/home/BookingConfirmScreen';
import { BookingSlotsScreen } from '../screens/home/BookingSlotsScreen';
import { BusinessDetailsScreen } from '../screens/home/BusinessDetailsScreen';
import { BusinessListScreen } from '../screens/home/BusinessListScreen';
import { CategoriesScreen } from '../screens/home/CategoriesScreen';
import type { HomeStackParamList } from './types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStackNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CategoriesScreen" component={CategoriesScreen} />
      <Stack.Screen name="BusinessList" component={BusinessListScreen} />
      <Stack.Screen name="BusinessDetails" component={BusinessDetailsScreen} />
      <Stack.Screen name="BookingSlots" component={BookingSlotsScreen} />
      <Stack.Screen name="BookingConfirm" component={BookingConfirmScreen} />
    </Stack.Navigator>
  );
}
