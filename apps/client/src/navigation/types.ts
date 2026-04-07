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
  Home: undefined;
  Map: undefined;
  Bookings: undefined;
  Profile: undefined;
};

// Home stack navigator params
export type HomeStackParamList = {
  HomeScreen: undefined;
  BusinessDetails: { businessId: string };
  BookingSlots: { businessId: string; staffId?: string };
  BookingConfirm: {
    bookingId: string;
    businessName: string;
    staffName: string;
    serviceName: string;
    date: string;
    startTime: string;
    price: number;
  };
};

// Bookings stack navigator params
export type BookingsStackParamList = {
  BookingsList: undefined;
  BookingDetails: { bookingId: string };
};

// Profile stack navigator params
export type ProfileStackParamList = {
  ProfileMain: undefined;
  EditProfile: undefined;
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

export type HomeTabScreenProps<T extends keyof RootTabParamList> = BottomTabScreenProps<
  RootTabParamList,
  T
>;

export type HomeStackScreenProps<T extends keyof HomeStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, T>,
  BottomTabScreenProps<RootTabParamList>
>;

export type BookingsStackScreenProps<T extends keyof BookingsStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<BookingsStackParamList, T>,
    BottomTabScreenProps<RootTabParamList>
  >;

export type ProfileStackScreenProps<T extends keyof ProfileStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<ProfileStackParamList, T>,
  BottomTabScreenProps<RootTabParamList>
>;

// Allow TypeScript to know the navigation type globally
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
