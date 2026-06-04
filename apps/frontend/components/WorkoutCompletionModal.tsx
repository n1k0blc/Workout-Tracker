'use client';

import { useState, useEffect } from 'react';
import Confetti from 'react-confetti';
import { useSwipe } from '@/hooks/useSwipe';
import { Workout, PersonalRecord } from '@/types';
import { calculateWorkoutStats } from '@/lib/workoutStats';
import {
  IconX,
  IconChevronLeft,
  IconChevronRight,
} from '@tabler/icons-react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { VolumeSlide } from './slides/VolumeSlide';
import { DurationSlide } from './slides/DurationSlide';
import { ExercisesSlide } from './slides/ExercisesSlide';
import { SetsSlide } from './slides/SetsSlide';
import { PRsSlide } from './slides/PRsSlide';
import { SummarySlide } from './slides/SummarySlide';

interface WorkoutCompletionModalProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  workout: Workout;
  personalRecords?: PersonalRecord[];
  onClose?: () => void;
}

export function WorkoutCompletionModal({
  open,
  onOpenChange,
  workout,
  personalRecords = [],
  onClose,
}: WorkoutCompletionModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showConfetti, setShowConfetti] = useState(true);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  const stats = calculateWorkoutStats(workout, personalRecords);
  
  // Determine slides to show (skip PRs if none)
  const hasPRs = stats.personalRecords.length > 0;
  const totalSlides = hasPRs ? 6 : 5;

  useEffect(() => {
    // Set window size for confetti (initial + resize listener)
    const updateSize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    updateSize();
    window.addEventListener('resize', updateSize);

    // Stop confetti after 3 seconds
    const timer = setTimeout(() => {
      setShowConfetti(false);
    }, 3000);

    return () => {
      window.removeEventListener('resize', updateSize);
      clearTimeout(timer);
    };
  }, []);

  // Swipe handlers
  useSwipe({
    onSwipeLeft: () => {
      if (currentSlide < totalSlides - 1) {
        setCurrentSlide(currentSlide + 1);
      }
    },
    onSwipeRight: () => {
      if (currentSlide > 0) {
        setCurrentSlide(currentSlide - 1);
      }
    },
  });

  const goToNextSlide = () => {
    if (currentSlide < totalSlides - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const goToPrevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const renderSlide = () => {
    // Adjust slide index if PRs are skipped
    let slideIndex = currentSlide;
    if (!hasPRs && currentSlide >= 4) {
      slideIndex = currentSlide + 1; // Skip PRs slide
    }

    switch (slideIndex) {
      case 0:
        return <VolumeSlide volume={stats.totalVolume} />;
      case 1:
        return <DurationSlide duration={stats.duration} />;
      case 2:
        return <ExercisesSlide count={stats.exerciseCount} />;
      case 3:
        return <SetsSlide count={stats.setCount} />;
      case 4:
        return <PRsSlide personalRecords={stats.personalRecords} />;
      case 5:
        return <SummarySlide workout={workout} />;
      default:
        return null;
    }
  };

  const isLastSlide = currentSlide === totalSlides - 1;

  const handleClose = () => {
    if (onOpenChange) onOpenChange(false);
    if (onClose) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (onOpenChange) onOpenChange(o);
      if (!o && onClose) onClose();
    }}>
      {/* Confetti (outside content for layering) */}
      {showConfetti && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={300}
        />
      )}

      <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-xl [&>button]:hidden">
        {/* Close / Skip Button (top right, no default X) */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 h-9 w-9 rounded-full bg-muted/80 hover:bg-muted"
          aria-label="Überspringen"
        >
          <IconX className="h-4 w-4" />
        </Button>

        {/* Slide Content */}
        <div className="min-h-[500px] flex items-center justify-center p-8 bg-card">
          <div className="w-full">
            {renderSlide()}
          </div>
        </div>

        {/* Navigation */}
        <div className="px-8 pb-8 bg-card border-t">
          {/* Progress Dots */}
          <div className="flex justify-center gap-2 mb-6 pt-6">
            {Array.from({ length: totalSlides }).map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-2 rounded-full transition-all ${
                  index === currentSlide
                    ? 'w-8 bg-primary'
                    : 'w-2 bg-muted hover:bg-muted-foreground/30'
                }`}
                aria-label={`Zu Slide ${index + 1} gehen`}
              />
            ))}
          </div>

          {/* Desktop Navigation Arrows + Finish Button */}
          <div className="flex items-center justify-between">
            {/* Previous Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={goToPrevSlide}
              disabled={currentSlide === 0}
              className={`hidden md:flex items-center gap-2 ${currentSlide === 0 ? 'opacity-0 pointer-events-none' : ''}`}
            >
              <IconChevronLeft className="h-4 w-4" />
              Zurück
            </Button>

            {/* Finish or Skip Button */}
            {isLastSlide ? (
              <Button
                onClick={handleClose}
                className="mx-auto px-8 py-3"
              >
                Fertig
              </Button>
            ) : (
              <Button
                variant="ghost"
                onClick={handleClose}
                className="mx-auto"
              >
                Überspringen
              </Button>
            )}

            {/* Next Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextSlide}
              disabled={isLastSlide}
              className={`hidden md:flex items-center gap-2 ${isLastSlide ? 'opacity-0 pointer-events-none' : ''}`}
            >
              Weiter
              <IconChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
