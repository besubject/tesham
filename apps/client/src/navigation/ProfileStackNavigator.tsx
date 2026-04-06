import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import type { ProfileStackParamList } from './types';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStackNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
    </Stack.Navigator>
  );
}
