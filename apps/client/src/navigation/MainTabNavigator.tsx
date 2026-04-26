import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Text } from 'react-native';
import { BookingsStackNavigator } from './BookingsStackNavigator';
import { CatalogStackNavigator } from './CatalogStackNavigator';
import { HomeStackNavigator } from './HomeStackNavigator';
import { ProfileStackNavigator } from './ProfileStackNavigator';
import type { RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();

function TabIcon({ label }: { label: string }): React.JSX.Element {
  return <Text style={{ fontSize: 20 }}>{label}</Text>;
}

export function MainTabNavigator(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1D6B4F',
        tabBarInactiveTintColor: '#8A8A86',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E8E8E4',
          borderTopWidth: 1,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeStackNavigator}
        options={{
          tabBarLabel: 'Категории',
          tabBarIcon: () => <TabIcon label="🏷️" />,
          tabBarAccessibilityLabel: 'Категории',
        }}
      />
      <Tab.Screen
        name="Catalog"
        component={CatalogStackNavigator}
        options={{
          tabBarLabel: 'Каталог',
          tabBarIcon: () => <TabIcon label="🔍" />,
          tabBarAccessibilityLabel: 'Каталог',
        }}
      />
      <Tab.Screen
        name="Bookings"
        component={BookingsStackNavigator}
        options={{
          tabBarLabel: 'Записи',
          tabBarIcon: () => <TabIcon label="📅" />,
          tabBarAccessibilityLabel: 'Записи',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={{
          tabBarLabel: 'Профиль',
          tabBarIcon: () => <TabIcon label="👤" />,
          tabBarAccessibilityLabel: 'Профиль',
        }}
      />
    </Tab.Navigator>
  );
}
