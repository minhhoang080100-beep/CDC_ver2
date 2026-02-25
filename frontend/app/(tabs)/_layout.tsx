import { Tabs } from 'expo-router';
import React from 'react';
import { View, Platform } from 'react-native';
import { Home, Calendar, BookOpen, IdCard, Settings } from 'lucide-react-native';

import { Colors } from '../../constants/Colors';
import { useResponsive } from '../../hooks/useResponsive';
import DesktopSidebar from '../../components/DesktopSidebar';
import { usePushNotifications } from '../../hooks/usePushNotifications';

export default function TabsLayout() {
  const { isDesktop, sidebarWidth } = useResponsive();
  usePushNotifications(); // Registers token in the background

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      {/* Desktop Sidebar */}
      {isDesktop && <DesktopSidebar width={sidebarWidth} />}

      {/* Main Content */}
      <View style={{ flex: 1, marginLeft: isDesktop ? sidebarWidth : 0 }}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: Colors.primary,
            tabBarInactiveTintColor: Colors.text.secondary,
            tabBarStyle: isDesktop
              ? { display: 'none' }
              : {
                backgroundColor: Colors.surface,
                borderTopWidth: 1,
                borderTopColor: Colors.divider,
                height: 70,
                paddingBottom: 10,
                paddingTop: 10,
              },
            tabBarLabelStyle: {
              fontSize: 12,
              fontWeight: '600',
            },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Bảng tin',
              tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
            }}
          />
          <Tabs.Screen
            name="activities"
            options={{
              title: 'Hoạt động',
              tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} />,
            }}
          />
          <Tabs.Screen
            name="library"
            options={{
              title: 'Thư viện',
              tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} />,
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: 'Thẻ ĐV',
              tabBarIcon: ({ color, size }) => <IdCard color={color} size={size} />,
            }}
          />
          <Tabs.Screen
            name="settings"
            options={{
              title: 'Cài đặt',
              tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
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
              href: null, // Only accessible via sidebar or custom logic
            }}
          />
          <Tabs.Screen
            name="post-detail"
            options={{
              href: null,
            }}
          />
        </Tabs>
      </View>
    </View>
  );
}