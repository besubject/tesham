import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabNavigationEventMap } from '@react-navigation/bottom-tabs';
import type { NavigationHelpers, ParamListBase, TabNavigationState } from '@react-navigation/native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, monoFont } from '@mettig/shared';
import { BookingsStackNavigator } from './BookingsStackNavigator';
import { CatalogStackNavigator } from './CatalogStackNavigator';
import { HomeStackNavigator } from './HomeStackNavigator';
import { ProfileStackNavigator } from './ProfileStackNavigator';
import type { RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();

const TAB_ITEMS = [
  { name: 'Home'     as const, label: 'Главная' },
  { name: 'Catalog'  as const, label: 'Каталог' },
  { name: 'Bookings' as const, label: 'Записи'  },
  { name: 'Profile'  as const, label: 'Я'       },
];

function CustomTabBar({ state, navigation }: {
  state: TabNavigationState<ParamListBase>;
  navigation: NavigationHelpers<ParamListBase, BottomTabNavigationEventMap>;
}): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <View style={[barStyles.wrapper, { paddingBottom: insets.bottom + 8 }]}>
      <View style={barStyles.pill}>
        {TAB_ITEMS.map((item, index) => {
          const isFocused = state.index === index;
          const routeKey = state.routes[index]?.key ?? '';

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: routeKey,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(item.name);
            }
          };

          return (
            <View
              key={item.name}
              style={[barStyles.tab, isFocused && barStyles.tabActive]}
              onStartShouldSetResponder={() => true}
              onResponderGrant={onPress}
            >
              <Text style={[barStyles.label, isFocused && barStyles.labelActive]}>
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const barStyles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 0,
    pointerEvents: 'box-none',
  } as const,
  pill: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.text,       // ink — dark pill
    borderRadius: 999,
    padding: 6,
    shadowColor: '#181715',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  tabActive: {
    backgroundColor: colors.surface,
  },
  label: {
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.70)',
    letterSpacing: 0.2,
  },
  labelActive: {
    color: colors.text,
  },
});

export function MainTabNavigator(): React.JSX.Element {
  return (
    <Tab.Navigator
      tabBar={(props) => (
        <CustomTabBar
          state={props.state}
          navigation={props.navigation}
        />
      )}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home"     component={HomeStackNavigator} />
      <Tab.Screen name="Catalog"  component={CatalogStackNavigator} />
      <Tab.Screen name="Bookings" component={BookingsStackNavigator} />
      <Tab.Screen name="Profile"  component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
}
