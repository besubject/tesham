import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { BusinessProfileScreen } from '../screens/profile/BusinessProfileScreen';
import type { BusinessProfileStackParamList } from './types';

const Stack = createNativeStackNavigator<BusinessProfileStackParamList>();

export function BusinessProfileStackNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={BusinessProfileScreen} />
    </Stack.Navigator>
  );
}
