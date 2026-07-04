import { Tabs } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';

const ORANGE = '#F97316';
const GRAY = '#9CA3AF';

function DashboardIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={3} width={8} height={8} rx={2} stroke={color} strokeWidth={2} fill={color === ORANGE ? ORANGE + '22' : 'none'} />
      <Rect x={13} y={3} width={8} height={8} rx={2} stroke={color} strokeWidth={2} fill={color === ORANGE ? ORANGE + '22' : 'none'} />
      <Rect x={3} y={13} width={8} height={8} rx={2} stroke={color} strokeWidth={2} fill={color === ORANGE ? ORANGE + '22' : 'none'} />
      <Rect x={13} y={13} width={8} height={8} rx={2} stroke={color} strokeWidth={2} fill={color === ORANGE ? ORANGE + '22' : 'none'} />
    </Svg>
  );
}

function PackagesIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M3 7L12 3L21 7V17L12 21L3 17V7Z" stroke={color} strokeWidth={2} strokeLinejoin="round" fill={color === ORANGE ? ORANGE + '22' : 'none'} />
      <Path d="M12 3V21M3 7L12 11L21 7" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function MenuIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2C8 2 5 5 5 8C5 12 8 14 8 14H16C16 14 19 12 19 8C19 5 16 2 12 2Z" stroke={color} strokeWidth={2} fill={color === ORANGE ? ORANGE + '22' : 'none'} />
      <Path d="M8 14V20M16 14V20M6 20H18" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function BookingsIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={4} width={18} height={17} rx={3} stroke={color} strokeWidth={2} fill={color === ORANGE ? ORANGE + '22' : 'none'} />
      <Path d="M8 2V6M16 2V6M3 10H21" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M8 14H10M14 14H16M8 18H10" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function MessagesIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={color === ORANGE ? ORANGE + '22' : 'none'}
      />
      <Path d="M8 10H16M8 14H13" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function ProfileIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M3 21H21M12 3C9.8 3 8 4.8 8 7C8 9.2 9.8 11 12 11C14.2 11 16 9.2 16 7C16 4.8 14.2 3 12 3Z" stroke={color} strokeWidth={2} strokeLinecap="round" fill={color === ORANGE ? ORANGE + '22' : 'none'} />
      <Path d="M5 21V19C5 16.2 8.1 14 12 14C15.9 14 19 16.2 19 19V21" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function TabItem({ label, icon, focused }: { label: string; icon: React.ReactNode; focused: boolean }) {
  return (
    <View style={styles.tabItem}>
      <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
        {icon}
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
            <TabItem
              label="Dashboard"
              focused={focused}
              icon={<DashboardIcon color={focused ? ORANGE : GRAY} />}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="packages"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem
              label="Packages"
              focused={focused}
              icon={<PackagesIcon color={focused ? ORANGE : GRAY} />}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem
              label="Menu"
              focused={focused}
              icon={<MenuIcon color={focused ? ORANGE : GRAY} />}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem
              label="Bookings"
              focused={focused}
              icon={<BookingsIcon color={focused ? ORANGE : GRAY} />}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem
              label="Messages"
              focused={focused}
              icon={<MessagesIcon color={focused ? ORANGE : GRAY} />}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem
              label="Business"
              focused={focused}
              icon={<ProfileIcon color={focused ? ORANGE : GRAY} />}
            />
          ),
        }}
      />

      {/* Hidden screens */}
      <Tabs.Screen name="edit-profile"  options={{ href: null }} />
      <Tabs.Screen name="consultation"  options={{ href: null }} />
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
    height: Platform.OS === 'ios' ? 88 : 68,
    paddingBottom: Platform.OS === 'ios' ? 28 : 8,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 20,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    width: 64,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapActive: {
    backgroundColor: '#FEF3E8',
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