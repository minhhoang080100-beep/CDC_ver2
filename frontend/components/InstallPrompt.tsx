import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  Dimensions,
} from 'react-native';
import { X, Download } from 'lucide-react-native';

/**
 * InstallPrompt — PWA Install Banner (Web only)
 *
 * Listens for the browser `beforeinstallprompt` event and displays a
 * bottom banner inviting the user to install the app on their device.
 *
 * Behaviour:
 * - Only renders on web platform
 * - Auto-hides after user dismisses or installs
 * - Remembers dismissal via localStorage (won't show again for 7 days)
 * - Animates in from the bottom
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pwa-install-dismissed';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const slideAnim = useState(new Animated.Value(100))[0];

  useEffect(() => {
    // Only run on web
    if (Platform.OS !== 'web') return;

    // Check if user already dismissed recently
    try {
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (dismissed && Date.now() - Number(dismissed) < DISMISS_DURATION_MS) {
        return;
      }
    } catch {}

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Also detect if already installed
    const matchMedia = window.matchMedia?.('(display-mode: standalone)');
    if (matchMedia?.matches) {
      // Already installed — don't show
      return;
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  // Animate in
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        console.log('[PWA] User accepted install');
      }
    } catch (err) {
      console.warn('[PWA] Install prompt error:', err);
    }

    setDeferredPrompt(null);
    animateOut();
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    animateOut();
  }, []);

  const animateOut = () => {
    Animated.timing(slideAnim, {
      toValue: 150,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setVisible(false));
  };

  if (Platform.OS !== 'web' || !visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.iconBadge}>
          <Download color="#ffffff" size={20} />
        </View>

        <View style={styles.textWrap}>
          <Text style={styles.title}>Cài đặt ứng dụng</Text>
          <Text style={styles.subtitle}>
            Thêm Công Đoàn vào màn hình chính để truy cập nhanh hơn
          </Text>
        </View>

        <TouchableOpacity
          style={styles.installBtn}
          onPress={handleInstall}
          activeOpacity={0.8}
        >
          <Text style={styles.installBtnText}>Cài đặt</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.closeBtn}
          onPress={handleDismiss}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X color="#94a3b8" size={18} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const { width } = Dimensions.get('window');
const isNarrow = width < 480;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: isNarrow ? 12 : 20,
    paddingBottom: Platform.select({ ios: 34, default: 16 }),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
    gap: 12,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#0866ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
  },
  installBtn: {
    backgroundColor: '#0866ff',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  installBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
});
