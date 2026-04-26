import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';

// Root stack — auth vs main
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<RootTabParamList>;
};

// Auth stack navigator params
export type AuthStackParamList = {
  PhoneScreen: undefined;
  CodeScreen: { phone: string };
  NameScreen: { phone: string; accessToken: string; refreshToken: string };
};

// Bottom tab navigator params
export type RootTabParamList = {
  Bookings: undefined;
  Stats: undefined;
  BusinessProfile: undefined;
};

// Bookings stack navigator params
export type BookingsStackParamList = {
  BookingsList: undefined;
  BookingDetails: { bookingId: string };
  CreateSlots: { staffId?: string } | undefined;
  Chat: { bookingId: string; clientName: string; isReadOnly: boolean };
};

// Stats stack navigator params
export type StatsStackParamList = {
  AnalyticsMain: undefined;
  ClientsScreen: { segment?: string } | undefined;
  ClientCardScreen: { clientId: string; clientName: string | null };
  ReturnRateScreen: undefined;
  BroadcastsScreen: undefined;
};

// Business profile stack navigator params
export type BusinessProfileStackParamList = {
  ProfileMain: undefined;
  EditProfile: undefined;
  ManageStaff: undefined;
};

// Screen props types
export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type AuthStackScreenProps<T extends keyof AuthStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<AuthStackParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

export type RootTabScreenProps<T extends keyof RootTabParamList> = BottomTabScreenProps<
  RootTabParamList,
  T
>;

export type BookingsStackScreenProps<T extends keyof BookingsStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<BookingsStackParamList, T>,
  BottomTabScreenProps<RootTabParamList>
>;

export type StatsStackScreenProps<T extends keyof StatsStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<StatsStackParamList, T>,
  BottomTabScreenProps<RootTabParamList>
>;

export type AnalyticsStackScreenProps<T extends keyof StatsStackParamList> =
  StatsStackScreenProps<T>;

export type BusinessProfileStackScreenProps<T extends keyof BusinessProfileStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<BusinessProfileStackParamList, T>,
    BottomTabScreenProps<RootTabParamList>
  >;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // React Navigation requires interface merging here.
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
