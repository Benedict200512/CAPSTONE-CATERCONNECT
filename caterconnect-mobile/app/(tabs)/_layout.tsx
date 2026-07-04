import { Tabs } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

const ORANGE = '#F97316';
const GRAY = '#9CA3AF';


function HomeIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M3 12L12 3L21 12V21H15V15H9V21H3V12Z" stroke={color} strokeWidth={2} strokeLinejoin="round" fill={color === ORANGE ? ORANGE + '22' : 'none'} />
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
      <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={2} fill={color === ORANGE ? ORANGE + '22' : 'none'} />
      <Path d="M4 20C4 17 7.6 14 12 14C16.4 14 20 17 20 20" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function TabItem({ label, icon, focused }: { label: string; icon: React.ReactNode; focused: boolean }) {
  return (
    <View style={styles.tabItem}>
      <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
        {icon}
      </View>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
    </View>
  );
}

export default function TabLayout() {
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
              label="Home"
              focused={focused}
              icon={<HomeIcon color={focused ? ORANGE : GRAY} />}
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
              label="Profile"
              focused={focused}
              icon={<ProfileIcon color={focused ? ORANGE : GRAY} />}
            />
          ),
        }}
      />

      {/* Hidden screens */}
      <Tabs.Screen name="consultation"     options={{ href: null }} />
      <Tabs.Screen name="notifications"    options={{ href: null }} />
      <Tabs.Screen name="book/[catererId]" options={{ href: null }} />
      <Tabs.Screen name="complaints"       options={{ href: null }} />
      <Tabs.Screen name="edit-profile"     options={{ href: null }} />
      <Tabs.Screen name="caterer/[catererId]" options={{ href: null }}/>
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
    paddingTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 20,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 60,
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