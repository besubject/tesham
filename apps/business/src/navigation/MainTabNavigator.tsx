import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Text } from 'react-native';
import { BookingsStackNavigator } from './BookingsStackNavigator';
import { BusinessProfileStackNavigator } from './BusinessProfileStackNavigator';
import { StatsStackNavigator } from './StatsStackNavigator';
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
        name="Bookings"
        component={BookingsStackNavigator}
        options={{
          tabBarLabel: 'Записи',
          tabBarIcon: () => <TabIcon label="📅" />,
          tabBarAccessibilityLabel: 'Записи',
        }}
      />
      <Tab.Screen
        name="Stats"
        component={StatsStackNavigator}
        options={{
          tabBarLabel: 'Статистика',
          tabBarIcon: () => <TabIcon label="📊" />,
          tabBarAccessibilityLabel: 'Статистика',
        }}
      />
      <Tab.Screen
        name="BusinessProfile"
        component={BusinessProfileStackNavigator}
        options={{
          tabBarLabel: 'Заведение',
          tabBarIcon: () => <TabIcon label="🏢" />,
          tabBarAccessibilityLabel: 'Заведение',
        }}
      />
    </Tab.Navigator>
  );
}
