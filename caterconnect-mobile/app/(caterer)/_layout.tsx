import { Tabs } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';
import {
  LayoutDashboard,
  Package,
  Utensils,
  CalendarDays,
  MessageSquare,
  Store,
} from 'lucide-react-native';

const ORANGE = '#F97316';
const GRAY = '#9CA3AF';
const ACTIVE_BG = '#FFF7ED';

// Reusable Tab Item Component
function TabItem({ label, icon: Icon, focused }: { label: string; icon: any; focused: boolean }) {
  return (
    <View style={styles.tabItem}>
      <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
        <Icon 
          size={20} 
          color={focused ? ORANGE : GRAY} 
          strokeWidth={focused ? 2.5 : 2} 
        />
      </View>
      <Text
        style={[styles.tabLabel, focused && styles.tabLabelActive]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {label}
      </Text>
    </View>
  );
}

export default function CatererLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem label="Dashboard" icon={LayoutDashboard} focused={focused} />
          ),
        }}
      />
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
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem label="Business" icon={Store} focused={focused} />
          ),
        }}
      />

      {/* Hidden screens */}
      <Tabs.Screen name="reports" options={{ href: null }} />
      <Tabs.Screen name="availability" options={{ href: null }} />
      <Tabs.Screen name="edit-profile"  options={{ href: null }} />
      <Tabs.Screen name="faq"  options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="complaints"    options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 50, // Adjusted for 6 tabs to fit properly
  },
  iconWrap: {
    width: 44,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapActive: {
    backgroundColor: ACTIVE_BG,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: GRAY,
    letterSpacing: 0.1,
    textAlign: 'center',
    width: '100%',
  },
  tabLabelActive: {
    color: ORANGE,
    fontWeight: '800',
  },
});
