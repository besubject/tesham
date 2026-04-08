import { NavigationContainer } from '@react-navigation/native';
import { registerRootComponent } from 'expo';
import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';

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

function App(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

export default App;
registerRootComponent(App);
