import { useEffect, useRef } from 'react';

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

interface SwipeInput {
  x: number;
  y: number;
  time: number;
}

const SWIPE_THRESHOLD = 50; // Minimum distance for swipe
const SWIPE_VELOCITY = 0.3; // Minimum velocity (pixels/ms)

export function useSwipe(handlers: SwipeHandlers) {
  const touchStart = useRef<SwipeInput | null>(null);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStart.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStart.current) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStart.current.x;
      const deltaY = touch.clientY - touchStart.current.y;
      const deltaTime = Date.now() - touchStart.current.time;

      // Check if horizontal swipe (more horizontal than vertical)
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        const velocity = Math.abs(deltaX) / deltaTime;

        if (Math.abs(deltaX) > SWIPE_THRESHOLD && velocity > SWIPE_VELOCITY) {
          if (deltaX > 0 && handlers.onSwipeRight) {
            handlers.onSwipeRight();
          } else if (deltaX < 0 && handlers.onSwipeLeft) {
            handlers.onSwipeLeft();
          }
        }
      }

      touchStart.current = null;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handlers.onSwipeLeft, handlers.onSwipeRight]);
}
