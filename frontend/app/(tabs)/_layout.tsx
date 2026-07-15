import { Tabs } from 'expo-router';
import React, { useCallback } from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { Home, Calendar, BookOpen, IdCard, MoreHorizontal } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';

import { Colors } from '../../constants/Colors';
import { useResponsive } from '../../hooks/useResponsive';
import DesktopSidebar from '../../components/DesktopSidebar';
import FloatingMiniGameButton from '../../components/FloatingMiniGameButton';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useToast } from '../../contexts/ToastContext';

// Custom Tab Bar Icon with Active Pill Indicator
const TabIcon = ({ Icon, color, size, focused, label }: {
  Icon: any;
  color: string;
  size: number;
  focused: boolean;
  label: string;
}) => (
  <View style={tabStyles.iconContainer}>
    {focused && <View style={tabStyles.activePill} />}
    <Icon color={color} size={size} fill={focused ? color : 'transparent'} strokeWidth={focused ? 2.5 : 2} />
  </View>
);

const getDocumentAssetUrls = (doc: Document) => {
  const nodes = Array.from(doc.querySelectorAll('script[src], link[rel="stylesheet"][href]'));
  return nodes
    .map((node) => node.getAttribute('src') || node.getAttribute('href'))
    .filter((value): value is string => !!value)
    .map((value) => new URL(value, window.location.origin).href)
    .sort();
};

const reloadIfNewWebBundleAvailable = async () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  try {
    const response = await fetch(`/?miniGameUpdateCheck=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!response.ok) return false;

    const html = await response.text();
    const nextDocument = new DOMParser().parseFromString(html, 'text/html');
    const currentAssets = getDocumentAssetUrls(document);
    const nextAssets = getDocumentAssetUrls(nextDocument);

    if (
      currentAssets.length > 0 &&
      nextAssets.length > 0 &&
      currentAssets.join('|') !== nextAssets.join('|')
    ) {
      window.location.reload();
      return true;
    }
  } catch {
    // Keep the running game state usable if update probing fails.
  }
  return false;
};

export default function TabsLayout() {
  const { isDesktop, sidebarWidth } = useResponsive();
  usePushNotifications();

  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const handleWebSocketMessage = useCallback((msg: any) => {
    if (msg.type === 'ping') {
      return;
    }

    if (msg.title) {
      showToast({ message: msg.title, type: 'success' });
    }

    if (msg.type === 'mini_game_event') {
      const miniGameEvent = msg.data?.event;
      const invalidateMiniGameQueries = () => {
        queryClient.invalidateQueries({ queryKey: ['mini-games'] });
        queryClient.invalidateQueries({ queryKey: ['mini-game-active'] });
        queryClient.invalidateQueries({ queryKey: ['mini-game-state'] });
        queryClient.invalidateQueries({ queryKey: ['lucky-number-state'] });
        queryClient.invalidateQueries({ queryKey: ['lucky-number-tickets'] });
        if (miniGameEvent === 'settings_updated') {
          queryClient.invalidateQueries({ queryKey: ['mini-game-settings'] });
        }
      };

      if (miniGameEvent === 'started') {
        const delay = Math.floor(Math.random() * 1500);
        setTimeout(() => {
          void reloadIfNewWebBundleAvailable().then((willReload) => {
            if (!willReload) invalidateMiniGameQueries();
          });
        }, delay);
        return;
      }

      invalidateMiniGameQueries();
      return;
    }

    const typeToQuery: Record<string, string[]> = {
      new_post: ['posts'],
      new_activity: ['activities'],
      new_survey: ['surveys'],
      new_notification: ['notifications'],
      new_feedback: ['feedback'],
      new_honor: ['honors', 'campaigns'],
      new_course: ['courses'],
      new_registration: ['users'],
    };

    const queries = typeToQuery[msg.type];
    if (queries) {
      queries.forEach(q => queryClient.invalidateQueries({ queryKey: [q] }));
    }
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notifications-badge'] });
  }, [queryClient, showToast]);

  useWebSocket({ onMessage: handleWebSocketMessage });

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      {isDesktop && <DesktopSidebar width={sidebarWidth} />}

      <View style={{ flex: 1, marginLeft: isDesktop ? sidebarWidth : 0 }}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: Colors.primary,
            tabBarInactiveTintColor: Colors.text.secondary,
            tabBarStyle: isDesktop
              ? { display: 'none' }
              : {
                  position: 'absolute',
                  bottom: Platform.select({ ios: 24, android: 12, default: 12 }),
                  left: 16,
                  right: 16,
                  backgroundColor: '#ffffff',
                  borderRadius: 24,
                  height: 72,
                  paddingBottom: 8,
                  paddingTop: 0,
                  borderTopWidth: 0,
                  elevation: 12,
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: -4 },
                  shadowOpacity: 0.12,
                  shadowRadius: 16,
                },
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: '600',
              marginTop: 4,
              marginBottom: 0,
            },
            tabBarItemStyle: {
              paddingTop: 10,
            },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Bảng tin',
              tabBarIcon: ({ color, size, focused }) => (
                <TabIcon Icon={Home} color={color} size={22} focused={focused} label="Bảng tin" />
              ),
            }}
          />
          <Tabs.Screen
            name="activities"
            options={{
              title: 'Kế hoạch hoạt động',
              tabBarIcon: ({ color, size, focused }) => (
                <TabIcon Icon={Calendar} color={color} size={22} focused={focused} label="Kế hoạch hoạt động" />
              ),
            }}
          />
          <Tabs.Screen
            name="library"
            options={{
              title: 'Thư viện',
              tabBarIcon: ({ color, size, focused }) => (
                <TabIcon Icon={BookOpen} color={color} size={22} focused={focused} label="Thư viện" />
              ),
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: 'Thẻ ĐV',
              tabBarIcon: ({ color, size, focused }) => (
                <TabIcon Icon={IdCard} color={color} size={22} focused={focused} label="Thẻ ĐV" />
              ),
            }}
          />
          <Tabs.Screen
            name="more"
            options={{
              title: 'Thêm',
              tabBarIcon: ({ color, size, focused }) => (
                <TabIcon Icon={MoreHorizontal} color={color} size={22} focused={focused} label="Thêm" />
              ),
            }}
          />
          <Tabs.Screen
            name="feedback"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="admin"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="post-detail"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="surveys"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="mini-game"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="lucky-number"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="honors"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="elearning"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="settings"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="notifications"
            options={{
              href: null,
            }}
          />
        </Tabs>
      </View>
      <FloatingMiniGameButton />
    </View>
  );
}

const tabStyles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activePill: {
    position: 'absolute',
    top: -8,
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
});
