import { NavigationContainer } from '@react-navigation/native';
import { initI18n, i18n, useAuthStore } from '@mettig/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { registerRootComponent } from 'expo';
import React, { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';

globalThis.__METTIG_TOKEN_NAMESPACE__ = 'mettig_business';
initI18n('ru');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
    },
  },
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
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <SafeAreaProvider>
          <I18nSync />
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </SafeAreaProvider>
      </I18nextProvider>
    </QueryClientProvider>
  );
}

export default App;
registerRootComponent(App);
