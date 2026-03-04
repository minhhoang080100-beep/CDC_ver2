import { Tabs } from 'expo-router';
import React from 'react';
import { View, Platform } from 'react-native';
import { Home, Calendar, BookOpen, IdCard, MoreHorizontal } from 'lucide-react-native';

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
                borderTopWidth: 0, // Remove solid border, use shadow instead
                elevation: 10,     // Shadow for Android
                shadowColor: '#000', // Shadow for iOS
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                height: Platform.select({ ios: 90, android: 70, default: 80 }), // Increased height slightly
                paddingBottom: Platform.select({ ios: 28, android: 12, default: 12 }), // Increased paddingBottom
                paddingTop: 8,
              },
            tabBarLabelStyle: {
              fontSize: 12,
              fontWeight: '600',
              marginTop: 4, // Added margin to space out icon from text slightly
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
            name="more"
            options={{
              title: 'Thêm',
              tabBarIcon: ({ color, size }) => <MoreHorizontal color={color} size={size} />,
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
        </Tabs>
      </View>
    </View>
  );
}