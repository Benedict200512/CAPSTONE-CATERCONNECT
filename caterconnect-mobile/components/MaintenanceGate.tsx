
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  ActivityIndicator,
  AppState,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  Wrench,
  AlertTriangle,
  Lock,
  RefreshCw,
} from 'lucide-react-native';

import { supabase } from '@/lib/supabase';

// Adjust this relative path only if MaintenanceGate.tsx
// is located somewhere other than components/.
const caterLogo = require('../assets/images/caterlogo.png');

type Settings = {
  maintenance_enabled: boolean;
  maintenance_message: string;
  estimated_end_at: string | null;
};

type Status = 'loading' | 'ready' | 'maintenance' | 'error';

export default function MaintenanceGate({
  children,
}: {
  children: ReactNode;
}) {
  const [status, setStatus] = useState<Status>('loading');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [checking, setChecking] = useState(false);

  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  const check = useCallback(async (showSpinner = false) => {
    const requestId = ++requestIdRef.current;

    if (showSpinner) {
      setChecking(true);
    }

    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select(
          'maintenance_enabled,maintenance_message,estimated_end_at'
        )
        .eq('id', 'main')
        .single();

      if (error || !data) {
        throw error ?? new Error('Maintenance settings unavailable');
      }

      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      const value = data as Settings;

      setSettings(value);
      setStatus(
        value.maintenance_enabled ? 'maintenance' : 'ready'
      );
    } catch {
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      // Keep access restricted when platform status
      // cannot be verified.
      setStatus('error');
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setChecking(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    void check();

    const interval = setInterval(() => {
      void check();
    }, 30000);

    const subscription = AppState.addEventListener(
      'change',
      state => {
        if (state === 'active') {
          void check();
        }
      }
    );

    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;

      clearInterval(interval);
      subscription.remove();
    };
  }, [check]);

  // ---------------------------------------
  // Normal application
  // ---------------------------------------

  if (status === 'ready') {
    return <>{children}</>;
  }

  // ---------------------------------------
  // Professional CaterConnect welcome splash
  // ---------------------------------------

  if (status === 'loading') {
    return (
      <View style={styles.splashContainer}>
        <View style={styles.splashDecorationTop} />
        <View style={styles.splashDecorationBottom} />

        <View style={styles.splashContent}>
          <View style={styles.logoContainer}>
            <Image
              source={caterLogo}
              style={styles.splashLogo}
              resizeMode="contain"
              accessibilityLabel="CaterConnect logo"
            />
          </View>

          <Text style={styles.splashBrand}>
            CATER<Text style={styles.brandAccent}>CONNECT</Text>
          </Text>

          <View style={styles.brandDivider} />

          <Text style={styles.welcomeTitle}>
            Welcome to CaterConnect
          </Text>

          <Text style={styles.welcomeDescription}>
            Connecting your celebrations with the perfect catering experience.
          </Text>
        </View>

        <View style={styles.splashFooter}>
          <ActivityIndicator size="small" color="#EA580C" />

          <Text style={styles.splashLoadingText}>
            Preparing your experience...
          </Text>

          <Text style={styles.splashFooterText}>
            YOUR CELEBRATION, OUR CONNECTION
          </Text>
        </View>
      </View>
    );
  }

  // ---------------------------------------
  // Maintenance and connection error
  // ---------------------------------------

  const maintenance = status === 'maintenance';

  const end = settings?.estimated_end_at
    ? new Date(settings.estimated_end_at)
    : null;

  const endText =
    end && !Number.isNaN(end.getTime())
      ? end.toLocaleString('en-PH', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : null;

  return (
    <ScrollView
      contentContainerStyle={styles.center}
      bounces={false}
    >
      <View style={styles.card}>
        <Image
          source={caterLogo}
          style={styles.cardLogo}
          resizeMode="contain"
          accessibilityLabel="CaterConnect logo"
        />

        <Text style={styles.brand}>CATERCONNECT</Text>

        <View
          style={[
            styles.badgeContainer,
            maintenance
              ? styles.maintenanceBadge
              : styles.errorBadge,
          ]}
        >
          {maintenance ? (
            <Wrench size={30} color="#EA580C" />
          ) : (
            <AlertTriangle size={30} color="#DC2626" />
          )}
        </View>

        <Text style={styles.heading}>
          {maintenance
            ? 'Scheduled Maintenance'
            : 'Connection Unavailable'}
        </Text>

        <Text style={styles.message}>
          {maintenance
            ? settings?.maintenance_message ||
              'CaterConnect is temporarily undergoing scheduled maintenance to improve your experience.'
            : 'We could not verify the platform status. Please check your internet connection and try again.'}
        </Text>

        {maintenance && endText ? (
          <View style={styles.estimateBox}>
            <Text style={styles.estimateLabel}>
              ESTIMATED RESTORATION
            </Text>

            <Text style={styles.estimateValue}>
              {endText}
            </Text>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.button,
            checking && styles.disabled,
            pressed && styles.pressedButton,
          ]}
          onPress={() => {
            void check(true);
          }}
          disabled={checking}
          accessibilityRole="button"
          accessibilityLabel="Check platform status again"
        >
          {checking ? (
            <ActivityIndicator
              color="#FFFFFF"
              size="small"
            />
          ) : (
            <View style={styles.buttonContent}>
              <RefreshCw size={17} color="#FFFFFF" />

              <Text style={styles.buttonText}>
                Check Again
              </Text>
            </View>
          )}
        </Pressable>

        {maintenance ? (
          <View style={styles.footerNoteBox}>
            <View style={styles.noteRow}>
              <Lock size={15} color="#6B7280" />

              <Text style={styles.note}>
                Your existing bookings and account information
                are preserved.
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <Text style={styles.bottomBrand}>
        CATERCONNECT
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // ---------------------------------------
  // Welcome splash screen
  // ---------------------------------------

  splashContainer: {
    flex: 1,
    backgroundColor: '#FFFAF5',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  splashDecorationTop: {
    position: 'absolute',
    top: -120,
    right: -110,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#FFF0DF',
  },

  splashDecorationBottom: {
    position: 'absolute',
    bottom: -150,
    left: -110,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: '#FFF3E8',
  },

  splashContent: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 55,
  },

  logoContainer: {
    width: 142,
    height: 142,
    borderRadius: 38,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#FCE7D6',

    shadowColor: '#C2410C',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 5,
  },

  splashLogo: {
    width: 112,
    height: 112,
  },

  splashBrand: {
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: '#1F2937',
    textAlign: 'center',
  },

  brandAccent: {
    color: '#EA580C',
  },

  brandDivider: {
    width: 42,
    height: 4,
    backgroundColor: '#F97316',
    borderRadius: 10,
    marginTop: 18,
    marginBottom: 25,
  },

  welcomeTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.4,
  },

  welcomeDescription: {
    fontSize: 14,
    lineHeight: 23,
    color: '#6B7280',
    textAlign: 'center',
    maxWidth: 290,
  },

  splashFooter: {
    position: 'absolute',
    bottom: 48,
    alignItems: 'center',
    gap: 12,
  },

  splashLoadingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9A6B4B',
  },

  splashFooterText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#B8A99D',
    marginTop: 12,
  },

  // ---------------------------------------
  // Maintenance / error screen
  // ---------------------------------------

  center: {
    flexGrow: 1,
    minHeight: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F8F6F0',
  },

  card: {
    width: '100%',
    maxWidth: 420,
    padding: 30,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#EFECE6',
    alignItems: 'center',

    shadowColor: '#111827',
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },

  cardLogo: {
    width: 82,
    height: 82,
    marginBottom: 8,
  },

  badgeContainer: {
    width: 68,
    height: 68,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },

  maintenanceBadge: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },

  errorBadge: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },

  brand: {
    color: '#F97316',
    fontWeight: '900',
    letterSpacing: 3,
    fontSize: 11,
    marginBottom: 22,
  },

  heading: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },

  message: {
    color: '#4B5563',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 22,
  },

  estimateBox: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    alignItems: 'center',
    marginBottom: 22,
  },

  estimateLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginBottom: 5,
  },

  estimateValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F2937',
  },

  button: {
    backgroundColor: '#F97316',
    paddingVertical: 15,
    paddingHorizontal: 28,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',

    shadowColor: '#F97316',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },

  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },

  pressedButton: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },

  disabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.3,
  },

  footerNoteBox: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 18,
    width: '100%',
  },

  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },

  note: {
    color: '#6B7280',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '500',
    flexShrink: 1,
  },

  bottomBrand: {
    marginTop: 24,
    fontSize: 10,
    letterSpacing: 3,
    fontWeight: '800',
    color: '#C4B5A8',
  },
});
