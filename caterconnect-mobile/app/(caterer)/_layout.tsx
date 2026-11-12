import { Tabs, Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  LayoutDashboard,
  Package,
  Utensils,
  CalendarDays,
  MessageSquare,
  Store,
} from 'lucide-react-native';

import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const ORANGE = '#F97316';
const GRAY = '#9CA3AF';
const ACTIVE_BG = '#FFF7ED';

// Match Caterer Web: only an APPROVED business can use its operating screens.
const MAIN_TABS = [
  { name: 'index', label: 'Dashboard', icon: LayoutDashboard, requiresApproval: false },
  { name: 'packages', label: 'Packages', icon: Package, requiresApproval: true },
  { name: 'menu', label: 'Menu', icon: Utensils, requiresApproval: true },
  { name: 'bookings', label: 'Bookings', icon: CalendarDays, requiresApproval: true },
  { name: 'messages', label: 'Messages', icon: MessageSquare, requiresApproval: true },
  { name: 'profile', label: 'Business', icon: Store, requiresApproval: false },
] as const;

function TabItem({
  label,
  icon: Icon,
  focused,
  disabled = false,
}: {
  label: string;
  icon: typeof LayoutDashboard;
  focused: boolean;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.tabItem, disabled && styles.disabledTab]}>
      <View style={[styles.iconWrap, focused && !disabled && styles.iconWrapActive]}>
        <Icon
          size={20}
          color={focused && !disabled ? ORANGE : GRAY}
          strokeWidth={focused && !disabled ? 2.5 : 2}
        />
      </View>
      <Text
        style={[styles.tabLabel, focused && !disabled && styles.tabLabelActive]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {label}
      </Text>
    </View>
  );
}

export default function CatererLayout() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ORANGE} />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;
  if (!profile) return <Redirect href="/(auth)/welcome" />;
  if (profile.status?.trim().toLowerCase() === 'suspended') {
    return <Redirect href="/(auth)/login" />;
  }
  if (profile.role !== 'caterer') return <Redirect href="/(auth)/welcome" />;

  return <VerifiedCatererTabs userId={session.user.id} />;
}

function VerifiedCatererTabs({ userId }: { userId: string }) {
  // Fail closed: until we can confirm approval, only Dashboard/Business are accessible.
  const [isApproved, setIsApproved] = useState(false);

  useEffect(() => {
    let active = true;
    let latestRequest = 0;

    const checkVerification = async () => {
      const request = ++latestRequest;
      try {
        const { data, error } = await supabase
          .from('caterers')
          .select('verification_status')
          .eq('user_id', userId)
          .maybeSingle();

        if (!active || request !== latestRequest) return;
        // A missing record or failed status lookup must NOT grant business access.
        setIsApproved(
          !error &&
          String(data?.verification_status ?? '').trim().toLowerCase() === 'approved',
        );
        if (error) console.warn('Caterer verification check failed:', error.message);
      } catch (error) {
        if (!active || request !== latestRequest) return;
        setIsApproved(false);
        console.warn('Caterer verification check failed:', error);
      }
    };

    setIsApproved(false);
    void checkVerification();

    // Reflect Staff approval/rejection without requiring a new login.
    const timer = setInterval(() => void checkVerification(), 15_000);
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void checkVerification();
    });

    return () => {
      active = false;
      latestRequest += 1;
      clearInterval(timer);
      appStateSubscription.remove();
    };
  }, [userId]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
      }}
      // Show the same six labels as Caterer Web when access is restricted.
      // Restricted items remain visible, but cannot be pressed.
      tabBar={isApproved ? undefined : ({ state, navigation }) => (
        <View style={[styles.tabBar, styles.tabBarRow]}>
          {MAIN_TABS.map((item) => {
            const focused = state.routes[state.index]?.name === item.name;
            return (
              <Pressable
                key={item.name}
                style={styles.tabButton}
                disabled={item.requiresApproval}
                onPress={() => navigation.navigate(item.name)}
                accessibilityRole="tab"
                accessibilityLabel={item.label}
                accessibilityHint={item.requiresApproval ? 'Available after business verification is approved' : undefined}
                accessibilityState={{ selected: focused, disabled: item.requiresApproval }}
              >
                <TabItem
                  label={item.label}
                  icon={item.icon}
                  focused={focused}
                  disabled={item.requiresApproval}
                />
              </Pressable>
            );
          })}
        </View>
      )}
    >
      {/* Accessible before approval */}
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem label="Dashboard" icon={LayoutDashboard} focused={focused} />
          ),
        }}
      />

      {/* Approved caterers only: these routes are also protected against direct navigation. */}
      <Tabs.Protected guard={isApproved}>
        <Tabs.Screen
          name="packages"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabItem label="Packages" icon={Package} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="menu"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabItem label="Menu" icon={Utensils} focused={focused} />
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
        <Tabs.Screen
          name="messages"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabItem label="Messages" icon={MessageSquare} focused={focused} />
            ),
          }}
        />
      </Tabs.Protected>

      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem label="Business" icon={Store} focused={focused} />
          ),
        }}
      />

      {/* Keep profile editing available so unsubmitted/rejected caterers can correct documents. */}
      <Tabs.Screen name="edit-profile" options={{ href: null }} />

      {/* Remaining routes require approval, even when opened through a direct link. */}
      <Tabs.Protected guard={isApproved}>
        <Tabs.Screen name="subscription" options={{ href: null }} />
        <Tabs.Screen name="reports" options={{ href: null }} />
        <Tabs.Screen name="availability" options={{ href: null }} />
        <Tabs.Screen name="faq" options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
        <Tabs.Screen name="complaints" options={{ href: null }} />
      </Tabs.Protected>
    </Tabs>
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
  tabBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  disabledTab: { opacity: 0.35 },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 50,
  },
  iconWrap: {
    width: 44,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapActive: { backgroundColor: ACTIVE_BG },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: GRAY,
    letterSpacing: 0.1,
    textAlign: 'center',
    width: '100%',
  },
  tabLabelActive: { color: ORANGE, fontWeight: '800' },
});
