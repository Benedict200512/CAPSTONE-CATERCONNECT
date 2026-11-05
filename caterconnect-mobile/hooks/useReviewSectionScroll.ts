import { useEffect, useRef } from 'react';
import { ScrollView, type LayoutChangeEvent } from 'react-native';

// Layout-driven scrolling: no timer, query, or notification write.
export function useReviewSectionScroll(bookingId: string | null, focusKey: string | null) {
  const scrollRef = useRef<ScrollView>(null);
  const offset = useRef<{ bookingId: string | null; y: number }>({ bookingId: null, y: 0 });
  const focused = useRef('');
  const scope = useRef({ bookingId, focusKey });
  scope.current = { bookingId, focusKey };
  useEffect(() => { if (!bookingId) focused.current = ''; }, [bookingId]);
  const focusReview = () => {
    const key = `${bookingId}:${focusKey}`;
    if (!bookingId || !focusKey || offset.current.bookingId !== bookingId || focused.current === key) return;
    requestAnimationFrame(() => {
      if (scope.current.bookingId !== bookingId || scope.current.focusKey !== focusKey || !scrollRef.current) return;
      scrollRef.current.scrollTo({ y: Math.max(0, offset.current.y - 12), animated: true });
      focused.current = key;
    });
  };
  const onReviewLayout = (event: LayoutChangeEvent) => {
    offset.current = { bookingId, y: event.nativeEvent.layout.y };
    focusReview();
  };
  return { scrollRef, onReviewLayout, onContentSizeChange: focusReview };
}
