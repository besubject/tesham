import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { CodeScreen } from '../screens/auth/CodeScreen';
import { NameScreen } from '../screens/auth/NameScreen';
import { PhoneScreen } from '../screens/auth/PhoneScreen';
import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStackNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PhoneScreen" component={PhoneScreen} />
      <Stack.Screen name="CodeScreen" component={CodeScreen} />
      <Stack.Screen name="NameScreen" component={NameScreen} />
    </Stack.Navigator>
  );
}
