import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { BookingsScreen } from '../screens/bookings/BookingsScreen';
import { ChatScreen } from '../screens/bookings/ChatScreen';
import { LeaveReviewScreen } from '../screens/bookings/LeaveReviewScreen';
import { ReviewsListScreen } from '../screens/bookings/ReviewsListScreen';
import type { BookingsStackParamList } from './types';

const Stack = createNativeStackNavigator<BookingsStackParamList>();

export function BookingsStackNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BookingsList" component={BookingsScreen} />
      <Stack.Screen name="ReviewsList" component={ReviewsListScreen} />
      <Stack.Screen name="LeaveReview" component={LeaveReviewScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
    </Stack.Navigator>
  );
}
