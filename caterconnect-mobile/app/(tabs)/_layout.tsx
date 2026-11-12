import { Tabs, Redirect } from 'expo-router';
import type { RefObject } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Animated,
} from 'react-native';
import {
  Home,
  CalendarDays,
  Heart,
  MessageSquare,
  User,
} from 'lucide-react-native';

import { PackageComparisonProvider } from '../../context/PackageComparisonContext';
import {
  PackageComparisonBar,
  useComparisonBarVisible,
} from '../../components/PackageComparisonControls';
import { useAuth } from '../../context/AuthContext';
import { FavoriteFlightProvider, useFavoriteFlight } from '../../context/FavoriteFlightContext';

const ORANGE = '#F97316';
const GRAY = '#9CA3AF';
const ACTIVE_BG = '#FFF7ED';

// Reusable bottom navigation item.
function TabItem({
  label,
  icon: Icon,
  focused,
  targetRef,
  pulse,
}: {
  label: string;
  icon: typeof Home;
  focused: boolean;
  targetRef?: RefObject<View | null>;
  pulse?: Animated.Value;
}) {
  return (
    <View style={styles.tabItem}>
      <Animated.View style={pulse ? { transform: [{ scale: pulse }] } : undefined}>
        <View ref={targetRef} style={[styles.iconWrap, focused && styles.iconWrapActive]}>
          <Icon
            size={22}
            color={focused ? ORANGE : GRAY}
            strokeWidth={focused ? 2.5 : 2}
          />
        </View>
      </Animated.View>

      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
        {label}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const { session, profile, loading } = useAuth();

  // Wait for authentication and profile information.
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ORANGE} />
      </View>
    );
  }

  // Not logged in: return to Login.
  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  // Profile unavailable: return to Welcome.
  if (!profile) {
    return <Redirect href="/(auth)/welcome" />;
  }

  // Suspended customers cannot access customer dashboard screens.
  if (profile.status?.trim().toLowerCase() === 'suspended') {
    return <Redirect href="/(auth)/login" />;
  }

  // Only customer accounts can access this layout.
  if (profile.role !== 'customer') {
    return <Redirect href="/(auth)/welcome" />;
  }

  return (
    <PackageComparisonProvider>
      <FavoriteFlightProvider>
        <CustomerTabs />
      </FavoriteFlightProvider>
    </PackageComparisonProvider>
  );
}

function CustomerTabs() {
  const comparisonVisible = useComparisonBarVisible();
  const { favoriteTabRef, favoritePulse } = useFavoriteFlight();

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: styles.tabBar,
          sceneStyle: {
            paddingBottom: comparisonVisible ? 112 : 0,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabItem label="Home" icon={Home} focused={focused} />
            ),
          }}
        />

        <Tabs.Screen
          name="bookings"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabItem label="Bookings" icon={CalendarDays} focused={focused} />
            ),
          }}
        />

        {/* Favorite is a visible tab between Bookings and Messages. */}
        <Tabs.Screen
          name="saved-packages"
          options={{
            title: 'Favorite',
            tabBarIcon: ({ focused }) => (
              <TabItem
                label="Favorite"
                icon={Heart}
                focused={focused}
                targetRef={favoriteTabRef}
                pulse={favoritePulse}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="messages"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabItem label="Messages" icon={MessageSquare} focused={focused} />
            ),
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabItem label="Profile" icon={User} focused={focused} />
            ),
          }}
        />

        {/* Hidden screens */}
        <Tabs.Screen name="package-comparison" options={{ href: null }} />
        <Tabs.Screen name="my-reviews" options={{ href: null }} />
        <Tabs.Screen name="faq" options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
        <Tabs.Screen name="book/[catererId]" options={{ href: null }} />
        <Tabs.Screen name="complaints" options={{ href: null }} />
        <Tabs.Screen name="edit-profile" options={{ href: null }} />
        <Tabs.Screen name="caterer/[catererId]" options={{ href: null }} />
      </Tabs>

      <PackageComparisonBar />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    height: Platform.OS === 'ios' ? 88 : 72,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 12,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 58,
  },
  iconWrap: {
    width: 48,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapActive: {
    backgroundColor: ACTIVE_BG,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: GRAY,
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: ORANGE,
    fontWeight: '800',
  },
});
