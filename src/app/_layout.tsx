import '@/tasks/backgroundLocation';

import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/auth/AuthContext';
import { DATABASE_NAME, migrateDatabase } from '@/database/schema';
import { NotificationCoordinator } from '@/components/NotificationCoordinator';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDatabase}>
          <AuthProvider>
            <NotificationCoordinator />
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: '#0B1830' },
                headerTintColor: '#FFFFFF',
                headerShadowVisible: false,
                contentStyle: { backgroundColor: '#F3F6FA' },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="home" options={{ headerShown: false }} />
              <Stack.Screen name="diagnostics/index" options={{ title: 'Diagnóstico técnico' }} />
              <Stack.Screen name="pending-receipts" options={{ title: 'Fotos pendentes' }} />
              <Stack.Screen name="completed-deliveries" options={{ title: 'Entregas concluídas' }} />
              <Stack.Screen name="occurrence" options={{ title: 'Registrar ocorrência' }} />
              <Stack.Screen name="receipt-capture" options={{ title: 'Fotografar canhoto' }} />
            </Stack>
          </AuthProvider>
        </SQLiteProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
