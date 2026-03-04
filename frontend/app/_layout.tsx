import { Stack } from 'expo-router';
import { AuthProvider } from '../contexts/AuthContext';
import { ToastProvider } from '../contexts/ToastContext';
import Toast from '../components/Toast';
import { ConfirmProvider } from '../contexts/ConfirmContext';
import ConfirmModal from '../components/ConfirmModal';
import ErrorBoundary from '../components/ErrorBoundary';
import { ThemeProvider } from '../contexts/ThemeContext';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
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
              </ConfirmProvider>
            </AuthProvider>
          </ToastProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}