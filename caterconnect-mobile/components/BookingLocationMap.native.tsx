import { forwardRef, useImperativeHandle, useRef } from 'react';
import MapView, { Marker, type MapPressEvent } from 'react-native-maps';
import type { BookingCoordinates, BookingLocationMapHandle, BookingLocationMapProps } from './BookingLocationMap.types';

const BookingLocationMap = forwardRef<BookingLocationMapHandle, BookingLocationMapProps>(
  function BookingLocationMap({ coordinates, title, onCoordinatesChange }, ref) {
    const mapRef = useRef<MapView>(null);

    useImperativeHandle(ref, () => ({
      animateToCoordinates: (nextCoordinates, duration) => {
        mapRef.current?.animateToRegion({
          ...nextCoordinates,
          latitudeDelta: 0.015,
          longitudeDelta: 0.0121,
        }, duration);
      },
    }));

    const handleMapPress = (event: MapPressEvent) => {
      const nextCoordinates: BookingCoordinates = event.nativeEvent.coordinate;
      onCoordinatesChange(nextCoordinates);
    };

    return (
      <MapView
        ref={mapRef}
        style={{ width: '100%', height: '100%' }}
        initialRegion={{
          ...coordinates,
          latitudeDelta: 0.015,
          longitudeDelta: 0.0121,
        }}
        onPress={handleMapPress}
      >
        <Marker
          coordinate={coordinates}
          title={title}
          description="Tap anywhere on map or use search bar"
        />
      </MapView>
    );
  }
);

export default BookingLocationMap;
