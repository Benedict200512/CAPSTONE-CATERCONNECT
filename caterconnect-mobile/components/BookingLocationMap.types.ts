export type BookingCoordinates = { latitude: number; longitude: number };

export type BookingLocationMapHandle = {
  animateToCoordinates: (coordinates: BookingCoordinates, duration?: number) => void;
};

export type BookingLocationMapProps = {
  coordinates: BookingCoordinates;
  title: string;
  onCoordinatesChange: (coordinates: BookingCoordinates) => void;
};
