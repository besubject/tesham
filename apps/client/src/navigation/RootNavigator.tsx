import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Text } from 'react-native';
import { MapScreen } from '../screens/map/MapScreen';
import { BookingsStackNavigator } from './BookingsStackNavigator';
import { HomeStackNavigator } from './HomeStackNavigator';
import { ProfileStackNavigator } from './ProfileStackNavigator';
import type { RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();

function TabIcon({ label }: { label: string }): React.JSX.Element {
  return <Text style={{ fontSize: 20 }}>{label}</Text>;
}

export function RootNavigator(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1a1a1a',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#e5e5e5',
          borderTopWidth: 1,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeStackNavigator}
        options={{
          tabBarLabel: 'Главная',
          tabBarIcon: () => <TabIcon label="🏠" />,
        }}
      />
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          tabBarLabel: 'Карта',
          tabBarIcon: () => <TabIcon label="🗺" />,
        }}
      />
      <Tab.Screen
        name="Bookings"
        component={BookingsStackNavigator}
        options={{
          tabBarLabel: 'Записи',
          tabBarIcon: () => <TabIcon label="📅" />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={{
          tabBarLabel: 'Профиль',
          tabBarIcon: () => <TabIcon label="👤" />,
        }}
      />
    </Tab.Navigator>
  );
}
