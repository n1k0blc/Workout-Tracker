'use client';

import { useState, useEffect } from 'react';
import Confetti from 'react-confetti';
import { useSwipe } from '@/hooks/useSwipe';
import { Workout, PersonalRecord } from '@/types';
import { WorkoutStats, calculateWorkoutStats } from '@/lib/workoutStats';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { VolumeSlide } from './slides/VolumeSlide';
import { DurationSlide } from './slides/DurationSlide';
import { ExercisesSlide } from './slides/ExercisesSlide';
import { SetsSlide } from './slides/SetsSlide';
import { PRsSlide } from './slides/PRsSlide';
import { SummarySlide } from './slides/SummarySlide';

interface WorkoutCompletionModalProps {
  workout: Workout;
  personalRecords?: PersonalRecord[];
  onClose: () => void;
}

export function WorkoutCompletionModal({
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
    // Set window size for confetti
    setWindowSize({
      width: window.innerWidth,
      height: window.innerHeight,
    });

    // Stop confetti after 3 seconds
    const timer = setTimeout(() => {
      setShowConfetti(false);
    }, 3000);

    return () => clearTimeout(timer);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      {/* Confetti */}
      {showConfetti && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={300}
        />
      )}

      {/* Modal Container */}
      <div className="relative w-full max-w-2xl mx-4 bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Skip Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          aria-label="Überspringen"
        >
          <X className="h-5 w-5 text-gray-600" />
        </button>

        {/* Slide Content */}
        <div className="min-h-[500px] flex items-center justify-center p-8">
          <div className="w-full">
            {renderSlide()}
          </div>
        </div>

        {/* Navigation */}
        <div className="px-8 pb-8">
          {/* Progress Dots */}
          <div className="flex justify-center gap-2 mb-6">
            {Array.from({ length: totalSlides }).map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-2 rounded-full transition-all ${
                  index === currentSlide
                    ? 'w-8 bg-blue-600'
                    : 'w-2 bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label={`Zu Slide ${index + 1} gehen`}
              />
            ))}
          </div>

          {/* Desktop Navigation Arrows + Finish Button */}
          <div className="flex items-center justify-between">
            {/* Previous Button */}
            <button
              onClick={goToPrevSlide}
              disabled={currentSlide === 0}
              className={`hidden md:flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                currentSlide === 0
                  ? 'opacity-0 cursor-default'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <ChevronLeft className="h-5 w-5" />
              Zurück
            </button>

            {/* Finish or Skip Button */}
            {isLastSlide ? (
              <button
                onClick={onClose}
                className="mx-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
              >
                Fertig
              </button>
            ) : (
              <button
                onClick={onClose}
                className="mx-auto px-6 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                Überspringen
              </button>
            )}

            {/* Next Button */}
            <button
              onClick={goToNextSlide}
              disabled={isLastSlide}
              className={`hidden md:flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isLastSlide
                  ? 'opacity-0 cursor-default'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              Weiter
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
