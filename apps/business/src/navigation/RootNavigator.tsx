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
        name="Bookings"
        component={BookingsStackNavigator}
        options={{
          tabBarLabel: 'Записи',
          tabBarIcon: () => <TabIcon label="📅" />,
        }}
      />
      <Tab.Screen
        name="Stats"
        component={StatsStackNavigator}
        options={{
          tabBarLabel: 'Статистика',
          tabBarIcon: () => <TabIcon label="📊" />,
        }}
      />
      <Tab.Screen
        name="BusinessProfile"
        component={BusinessProfileStackNavigator}
        options={{
          tabBarLabel: 'Заведение',
          tabBarIcon: () => <TabIcon label="🏢" />,
        }}
      />
    </Tab.Navigator>
  );
}
