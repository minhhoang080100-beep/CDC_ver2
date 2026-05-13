import { Stack } from 'expo-router';
import { AuthProvider } from '../contexts/AuthContext';
import { ToastProvider } from '../contexts/ToastContext';
import Toast from '../components/Toast';
import { ConfirmProvider } from '../contexts/ConfirmContext';
import ConfirmModal from '../components/ConfirmModal';
import ErrorBoundary from '../components/ErrorBoundary';
import { ThemeProvider } from '../contexts/ThemeContext';
import React from 'react';
import { Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import InstallPrompt from '../components/InstallPrompt';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,  // 5 minutes — reduce unnecessary refetches
      gcTime: 1000 * 60 * 60 * 24, // 24 hours — keep cache for offline use
    },
  },
});

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'CDC_QUERY_CACHE',
});

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: asyncStoragePersister }}>
          <ToastProvider>
            <AuthProvider>
              <ConfirmProvider>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="login" />
                  <Stack.Screen name="register" />
                  <Stack.Screen name="(tabs)" />
                </Stack>
                <Toast />
                <ConfirmModal />
                {Platform.OS === 'web' && <InstallPrompt />}
              </ConfirmProvider>
            </AuthProvider>
          </ToastProvider>
        </PersistQueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}