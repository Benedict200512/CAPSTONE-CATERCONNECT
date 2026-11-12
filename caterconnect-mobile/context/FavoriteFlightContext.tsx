import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Heart } from 'lucide-react-native';

type Position = { x: number; y: number };
type FlightPath = { from: Position; to: Position };

type FavoriteFlightValue = {
  // Coordinates are from the pressed heart's React Native pageX/pageY.
  flyToFavorite: (pageX: number, pageY: number) => void;
  favoriteTabRef: RefObject<View | null>;
  favoritePulse: Animated.Value;
};

const FavoriteFlightContext = createContext<FavoriteFlightValue | null>(null);
const HEART_SIZE = 26;
const ORANGE = '#F97316';

export function useFavoriteFlight(): FavoriteFlightValue {
  const value = useContext(FavoriteFlightContext);
  if (!value) {
    throw new Error('useFavoriteFlight must be used inside FavoriteFlightProvider.');
  }
  return value;
}

export function FavoriteFlightProvider({ children }: { children: ReactNode }) {
  const containerRef = useRef<View>(null);
  const favoriteTabRef = useRef<View>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const favoritePulse = useRef(new Animated.Value(1)).current;
  const sequence = useRef(0);
  const [flight, setFlight] = useState<FlightPath | null>(null);

  useEffect(() => {
    return () => {
      sequence.current += 1;
      progress.stopAnimation();
      favoritePulse.stopAnimation();
    };
  }, [progress, favoritePulse]);

  const flyToFavorite = useCallback((pageX: number, pageY: number) => {
    if (!Number.isFinite(pageX) || !Number.isFinite(pageY)) return;

    // Measure the tab itself rather than assuming screen width or safe-area size.
    containerRef.current?.measureInWindow((rootX, rootY, rootWidth, rootHeight) => {
      favoriteTabRef.current?.measureInWindow((tabX, tabY, tabWidth, tabHeight) => {
        if (rootWidth <= 0 || rootHeight <= 0 || tabWidth <= 0 || tabHeight <= 0) return;

        const from = {
          x: Math.min(Math.max(pageX - rootX, 0), rootWidth),
          y: Math.min(Math.max(pageY - rootY, 0), rootHeight),
        };
        const to = {
          x: tabX + tabWidth / 2 - rootX,
          y: tabY + tabHeight / 2 - rootY,
        };
        const current = ++sequence.current;
        progress.stopAnimation();
        favoritePulse.stopAnimation();
        favoritePulse.setValue(1);
        progress.setValue(0);
        setFlight({ from, to });

        // Wait for the animated heart to mount before starting its travel.
        requestAnimationFrame(() => {
          if (current !== sequence.current) return;
          Animated.timing(progress, {
            toValue: 1,
            duration: 720,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }).start(({ finished }) => {
            if (!finished || current !== sequence.current) return;
            setFlight(null);
            Animated.sequence([
              Animated.spring(favoritePulse, {
                toValue: 1.26,
                friction: 4,
                tension: 120,
                useNativeDriver: true,
              }),
              Animated.spring(favoritePulse, {
                toValue: 1,
                friction: 5,
                tension: 100,
                useNativeDriver: true,
              }),
            ]).start();
          });
        });
      });
    });
  }, [favoritePulse, progress]);

  const contextValue = useMemo<FavoriteFlightValue>(() => ({
    flyToFavorite,
    favoriteTabRef,
    favoritePulse,
  }), [flyToFavorite, favoritePulse]);

  const travelX = flight ? flight.to.x - flight.from.x : 0;
  const travelY = flight ? flight.to.y - flight.from.y : 0;

  return (
    <FavoriteFlightContext.Provider value={contextValue}>
      <View ref={containerRef} style={styles.root}>
        {children}
        {flight && (
          <Animated.View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.flyingHeart,
              {
                left: flight.from.x - HEART_SIZE / 2,
                top: flight.from.y - HEART_SIZE / 2,
                opacity: progress.interpolate({
                  inputRange: [0, 0.8, 1],
                  outputRange: [1, 1, 0.5],
                }),
                transform: [
                  { translateX: progress.interpolate({
                    inputRange: [0, 1], outputRange: [0, travelX],
                  }) },
                  { translateY: progress.interpolate({
                    inputRange: [0, 0.3, 0.65, 1],
                    outputRange: [0, -65, travelY * 0.55 - 45, travelY],
                  }) },
                  { scale: progress.interpolate({
                    inputRange: [0, 0.25, 0.75, 1],
                    outputRange: [0.8, 1.3, 1.1, 0.6],
                  }) },
                ],
              },
            ]}
          >
            <Heart size={HEART_SIZE} color={ORANGE} fill={ORANGE} strokeWidth={2.6} />
          </Animated.View>
        )}
      </View>
    </FavoriteFlightContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flyingHeart: {
    position: 'absolute',
    width: HEART_SIZE,
    height: HEART_SIZE,
    zIndex: 9999,
    elevation: 30,
  },
});
