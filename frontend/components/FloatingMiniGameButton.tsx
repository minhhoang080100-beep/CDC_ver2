import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react-native';

import { Colors } from '../constants/Colors';
import { useAuth } from '../contexts/AuthContext';
import { useResponsive } from '../hooks/useResponsive';
import { api } from '../utils/api';

type MiniGameSettings = {
  enabled: boolean;
};

type ActiveMiniGame = {
  id: string;
  status: 'DRAFT' | 'WAITING' | 'LIVE' | 'FINISHED';
} | null;

export default function FloatingMiniGameButton() {
  const router = useRouter();
  const pathname = usePathname();
  const { token } = useAuth();
  const { isDesktop } = useResponsive();
  const pulse = useRef(new Animated.Value(0)).current;

  const settingsQuery = useQuery({
    queryKey: ['mini-game-settings'],
    queryFn: async () => {
      const response = await api.get('/api/mini-games/settings');
      return response.data as MiniGameSettings;
    },
    enabled: !!token,
    refetchInterval: 30000,
  });

  const activeQuery = useQuery({
    queryKey: ['mini-game-active'],
    queryFn: async () => {
      const response = await api.get('/api/mini-games/active');
      return response.data as ActiveMiniGame;
    },
    enabled: !!token && settingsQuery.data?.enabled === true,
    refetchInterval: 5000,
  });

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 850,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 850,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  if (!settingsQuery.data?.enabled || activeQuery.data?.status !== 'LIVE' || pathname.includes('mini-game')) {
    return null;
  }

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.72] });

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, isDesktop ? styles.wrapperDesktop : styles.wrapperMobile]}>
      <Animated.View style={[styles.glow, { opacity, transform: [{ scale }] }]} />
      <TouchableOpacity
        style={styles.button}
        activeOpacity={0.86}
        onPress={() => router.push('/(tabs)/mini-game' as any)}
        accessibilityLabel="Mở Mini Game sự kiện"
      >
        <Trophy color="#ffffff" size={28} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: Platform.OS === 'web' ? 'fixed' as any : 'absolute',
    zIndex: 5000,
  },
  wrapperDesktop: {
    right: 24,
    bottom: 24,
  },
  wrapperMobile: {
    right: 18,
    bottom: 94,
  },
  glow: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  button: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 12,
  },
});
