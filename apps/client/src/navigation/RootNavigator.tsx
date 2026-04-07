import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '@mettig/shared';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AuthStackNavigator } from './AuthStackNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator(): React.JSX.Element {
  const { isAuthenticated, isLoading, initialize } = useAuthStore();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAF8' }}>
        <ActivityIndicator size="large" color="#1D6B4F" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <Stack.Screen name="Main" component={MainTabNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthStackNavigator} />
      )}
    </Stack.Navigator>
  );
}
