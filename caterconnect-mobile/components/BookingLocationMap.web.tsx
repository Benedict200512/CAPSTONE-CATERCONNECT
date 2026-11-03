import { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BookingLocationMapHandle, BookingLocationMapProps } from './BookingLocationMap.types';

const BookingLocationMap = forwardRef<BookingLocationMapHandle, BookingLocationMapProps>(
  function BookingLocationMap(_props, ref) {
    useImperativeHandle(ref, () => ({ animateToCoordinates: () => undefined }));

    return (
      <View style={styles.container}>
        <Text style={styles.message}>
          Map preview is unavailable on Web. Please use the CaterConnect Mobile App to view the map.
        </Text>
      </View>
    );
  }
);

export default BookingLocationMap;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F3F4F6',
  },
  message: {
    maxWidth: 420,
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
