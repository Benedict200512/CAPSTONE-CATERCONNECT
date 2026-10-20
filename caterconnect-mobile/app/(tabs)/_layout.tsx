import { Tabs } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Home, CalendarDays, MessageSquare, User } from 'lucide-react-native';
import { PackageComparisonProvider } from '../../context/PackageComparisonContext';
import { PackageComparisonBar, useComparisonBarVisible } from '../../components/PackageComparisonControls';

const ORANGE = '#F97316';
const GRAY = '#9CA3AF';
const ACTIVE_BG = '#FFF7ED';

// Reusable Tab Item Component
function TabItem({ label, icon: Icon, focused }: { label: string; icon: any; focused: boolean }) {
  return (
    <View style={styles.tabItem}>
      <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
        <Icon 
          size={22} 
          color={focused ? ORANGE : GRAY} 
          strokeWidth={focused ? 2.5 : 2} 
        />
      </View>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
        {label}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  return <PackageComparisonProvider><CustomerTabs /></PackageComparisonProvider>;
}

function CustomerTabs() {
  const comparisonVisible = useComparisonBarVisible();
  return (
    <View style={{ flex: 1 }}>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        sceneStyle: { paddingBottom: comparisonVisible ? 112 : 0 },
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
      <Tabs.Screen name="saved-packages" options={{ href: null }} />
      <Tabs.Screen name="faq"     options={{ href: null }} />
      <Tabs.Screen name="notifications"    options={{ href: null }} />
      <Tabs.Screen name="book/[catererId]" options={{ href: null }} />
      <Tabs.Screen name="complaints"       options={{ href: null }} />
      <Tabs.Screen name="edit-profile"     options={{ href: null }} />
      <Tabs.Screen name="caterer/[catererId]" options={{ href: null }} />
      
    </Tabs>
    <PackageComparisonBar />
    </View>
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
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 64,
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
