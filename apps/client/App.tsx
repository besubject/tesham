import { NavigationContainer } from '@react-navigation/native';
import { initI18n, i18n, useAuthStore } from '@mettig/shared';
import { registerRootComponent } from 'expo';
import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { I18nextProvider } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';

globalThis.__METTIG_TOKEN_NAMESPACE__ = 'mettig_client';
initI18n('ru');

interface ErrorBoundaryState { error: Error | null }

class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };
  static getDerivedStateFromError(error: Error): ErrorBoundaryState { return { error }; }
  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <ScrollView contentContainerStyle={errStyles.container}>
          <Text style={errStyles.title}>Ошибка запуска</Text>
          <Text style={errStyles.msg}>{this.state.error.message}</Text>
          <Text style={errStyles.stack}>{this.state.error.stack}</Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const errStyles = StyleSheet.create({
  container: { padding: 24, paddingTop: 60, backgroundColor: '#fff', flexGrow: 1 },
  title: { fontSize: 20, fontWeight: '700', color: '#C4462A', marginBottom: 12 },
  msg: { fontSize: 15, color: '#1A1A18', marginBottom: 16 },
  stack: { fontSize: 11, color: '#5C5C58', fontFamily: 'monospace' },
});

function I18nSync(): null {
  const userLanguage = useAuthStore((state) => state.user?.language);

  useEffect(() => {
    const nextLanguage = userLanguage ?? 'ru';
    if (i18n.resolvedLanguage !== nextLanguage) {
      void i18n.changeLanguage(nextLanguage);
    }
  }, [userLanguage]);

  return null;
}

function App(): React.JSX.Element {
  return (
    <I18nextProvider i18n={i18n}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <I18nSync />
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </SafeAreaProvider>
      </ErrorBoundary>
    </I18nextProvider>
  );
}

export default App;
registerRootComponent(App);
