import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
// MapScreen использует @maplibre/maplibre-react-native — требует нативной сборки (не работает в Expo Go)
// import { MapScreen } from '../screens/map/MapScreen';
import { BookingsStackNavigator } from './BookingsStackNavigator';
import { HomeStackNavigator } from './HomeStackNavigator';
import { ProfileStackNavigator } from './ProfileStackNavigator';
import type { RootTabParamList } from './types';

function MapPlaceholder(): React.JSX.Element {
  return (
    <View style={placeholderStyles.container}>
      <Text style={placeholderStyles.icon}>🗺️</Text>
      <Text style={placeholderStyles.title}>Карта недоступна в Expo Go</Text>
      <Text style={placeholderStyles.subtitle}>
        Для карты нужна нативная сборка.{'\n'}Запусти через «expo run:ios» или EAS Build.
      </Text>
    </View>
  );
}

const placeholderStyles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  icon: { fontSize: 48 },
  title: { fontSize: 18, fontWeight: '600', textAlign: 'center', color: '#1D1D1B' },
  subtitle: { fontSize: 14, textAlign: 'center', color: '#8A8A86', lineHeight: 20 },
});

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
          tabBarLabel: 'Главная',
          tabBarIcon: () => <TabIcon label="🏠" />,
          tabBarAccessibilityLabel: 'Главная',
        }}
      />
      <Tab.Screen
        name="Map"
        component={MapPlaceholder}
        options={{
          tabBarLabel: 'Карта',
          tabBarIcon: () => <TabIcon label="🗺" />,
          tabBarAccessibilityLabel: 'Карта',
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
