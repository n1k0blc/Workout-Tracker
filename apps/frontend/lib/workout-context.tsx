'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Workout, SetType } from '@/types';
import { apiClient } from '@/lib/api';

interface WorkoutContextType {
  activeWorkout: Workout | null;
  loading: boolean;
  isPaused: boolean;
  togglePause: () => void;
  isRestTimerPaused: boolean;
  toggleRestTimerPause: () => void;
  isPastWorkout: boolean;
  pastWorkoutDuration: number;
  setPastWorkoutDuration: (duration: number) => void;
  startWorkout: (data: {
    cycleId?: string;
    workoutDayId?: string;
    isFreeWorkout: boolean;
    homeGymId: string | null;
    isPastWorkout?: boolean;
    pastWorkoutDate?: string;
    pastWorkoutDuration?: number;
  }) => Promise<void>;
  completeWorkout: (data?: {
    totalDuration?: number;
    updateBlueprint?: boolean;
  }) => Promise<Workout | null>;
  discardWorkout: () => Promise<void>;
  addExercise: (exerciseId: string) => Promise<void>;
  removeExercise: (exerciseLogId: string) => Promise<void>;
  replaceExercise: (exerciseLogId: string, newExerciseId: string) => Promise<void>;
  reorderExercises: (exerciseIds: string[]) => Promise<void>;
  logSet: (
    exerciseLogId: string,
    data: {
      setNumber: number;
      reps: number;
      weight: number;
      rir?: number;
      setType?: SetType;
      plannedRestAfterSet?: number;
    }
  ) => Promise<void>;
  deleteSet: (setLogId: string) => Promise<void>;
  updateSet: (
    setLogId: string,
    data: {
      reps: number;
      weight: number;
      rir?: number;
    }
  ) => Promise<void>;
  refreshActiveWorkout: () => Promise<void>;
  setActiveWorkoutDirectly: (workout: Workout, isPastWorkout?: boolean, pastWorkoutDuration?: number) => void;
  workoutDuration: number;
  restTimer: number; // Elapsed seconds since rest started
  restTimerTarget: number; // Target rest duration in seconds
  pendingTemplateSave: { workoutId: string } | null;
  initTemplateSave: (workoutId: string) => void;
  cancelTemplateSave: () => void;
  completeTemplateSave: () => void;
}

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isRestTimerPaused, setIsRestTimerPaused] = useState(false);
  const [isPastWorkout, setIsPastWorkout] = useState(false);
  const [pastWorkoutDuration, setPastWorkoutDuration] = useState(0);
  const [workoutDuration, setWorkoutDuration] = useState(0);
  const [restTimer, setRestTimer] = useState(0); // Elapsed seconds
  const [restTimerTarget, setRestTimerTarget] = useState(0); // Target seconds
  const [restTimerStartedAt, setRestTimerStartedAt] = useState<number | null>(null);
  const [pendingTemplateSave, setPendingTemplateSave] = useState<{ workoutId: string } | null>(null);
  
  // Timestamp-based timers (stored in localStorage for persistence)
  const [workoutStartTime, setWorkoutStartTime] = useState<number | null>(null);
  const [restStartTime, setRestStartTime] = useState<number | null>(null);

  // Pause state - stores elapsed time when paused
  const [pausedWorkoutDuration, setPausedWorkoutDuration] = useState<number | null>(null);
  const [pausedRestTimer, setPausedRestTimer] = useState<number | null>(null);
  const [pausedRestTimerValue, setPausedRestTimerValue] = useState<number | null>(null);

  const workoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const restTimerRef = useRef<NodeJS.Timeout | null>(null);

  const togglePause = () => {
    setIsPaused(prev => {
      const newPausedState = !prev;
      
      if (newPausedState) {
        // Pausing: Freeze current elapsed times
        setPausedWorkoutDuration(workoutDuration);
        setPausedRestTimer(restTimer);
      } else {
        // Resuming: Adjust start times to account for paused duration
        if (pausedWorkoutDuration !== null && workoutStartTime !== null) {
          const newStartTime = Date.now() - (pausedWorkoutDuration * 1000);
          setWorkoutStartTime(newStartTime);
          if (typeof window !== 'undefined') {
            localStorage.setItem('workoutStartTime', newStartTime.toString());
          }
          setPausedWorkoutDuration(null);
        }
        
        if (pausedRestTimer !== null && restStartTime !== null) {
          const newRestStartTime = Date.now() - (pausedRestTimer * 1000);
          setRestStartTime(newRestStartTime);
          if (typeof window !== 'undefined') {
            localStorage.setItem('restStartTime', newRestStartTime.toString());
          }
          setPausedRestTimer(null);
        }
      }
      
      return newPausedState;
    });
  };

  const toggleRestTimerPause = () => {
    setIsRestTimerPaused(prev => {
      const newPausedState = !prev;
      
      if (newPausedState) {
        // Pausing rest timer only: Freeze current rest time
        setPausedRestTimerValue(restTimer);
      } else {
        // Resuming rest timer: Adjust start time to account for paused duration
        if (pausedRestTimerValue !== null && restStartTime !== null) {
          const newRestStartTime = Date.now() - (pausedRestTimerValue * 1000);
          setRestStartTime(newRestStartTime);
          if (typeof window !== 'undefined') {
            localStorage.setItem('restStartTime', newRestStartTime.toString());
          }
          setPausedRestTimerValue(null);
        }
      }
      
      return newPausedState;
    });
  };

  // Workout Duration Timer (timestamp-based, persists across tab switches and app restarts)
  useEffect(() => {
    if (activeWorkout && activeWorkout.status === 'IN_PROGRESS' && !isPaused && !isPastWorkout) {
      // Start timer if not already started
      if (workoutStartTime === null) {
        const now = Date.now();
        setWorkoutStartTime(now);
        if (typeof window !== 'undefined') {
          localStorage.setItem('workoutStartTime', now.toString());
        }
      }

      // Update duration every 100ms based on elapsed time
      workoutTimerRef.current = setInterval(() => {
        if (workoutStartTime !== null) {
          const elapsed = Math.floor((Date.now() - workoutStartTime) / 1000);
          setWorkoutDuration(elapsed);
        }
      }, 100);
    } else {
      if (workoutTimerRef.current) {
        clearInterval(workoutTimerRef.current);
        workoutTimerRef.current = null;
      }
      
      // When paused, keep displaying the frozen duration
      if (isPaused && pausedWorkoutDuration !== null) {
        setWorkoutDuration(pausedWorkoutDuration);
      }
      
      // Reset timer when no active workout
      if (!activeWorkout) {
        setWorkoutDuration(0);
        setWorkoutStartTime(null);
        setPausedWorkoutDuration(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('workoutStartTime');
        }
      }
    }

    return () => {
      if (workoutTimerRef.current) {
        clearInterval(workoutTimerRef.current);
      }
    };
  }, [activeWorkout, isPaused, isPastWorkout, workoutStartTime, pausedWorkoutDuration]);

  // Rest Timer (timestamp-based, persists across tab switches)
  useEffect(() => {
    if (restTimerStartedAt !== null && !isPaused && !isRestTimerPaused && !isPastWorkout) {
      // Set start time if not already set
      if (restStartTime === null) {
        setRestStartTime(restTimerStartedAt);
        if (typeof window !== 'undefined') {
          localStorage.setItem('restStartTime', restTimerStartedAt.toString());
          localStorage.setItem('restTimerTarget', restTimerTarget.toString());
        }
      }

      // Update rest timer every 100ms based on elapsed time
      restTimerRef.current = setInterval(() => {
        if (restStartTime !== null) {
          const elapsed = Math.floor((Date.now() - restStartTime) / 1000);
          setRestTimer(elapsed);
        }
      }, 100);
    } else {
      if (restTimerRef.current) {
        clearInterval(restTimerRef.current);
        restTimerRef.current = null;
      }
      
      // When globally paused, keep displaying the frozen rest timer
      if (isPaused && pausedRestTimer !== null) {
        setRestTimer(pausedRestTimer);
      }
      
      // When rest timer is individually paused, keep displaying the frozen value
      if (isRestTimerPaused && pausedRestTimerValue !== null) {
        setRestTimer(pausedRestTimerValue);
      }
      
      // Reset rest timer when stopped
      if (restTimerStartedAt === null) {
        setRestTimer(0);
        setRestStartTime(null);
        setPausedRestTimer(null);
        setPausedRestTimerValue(null);
        setIsRestTimerPaused(false);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('restStartTime');
          localStorage.removeItem('restTimerTarget');
        }
      }
    }

    return () => {
      if (restTimerRef.current) {
        clearInterval(restTimerRef.current);
      }
    };
  }, [restTimerStartedAt, restTimerTarget, isPaused, isRestTimerPaused, isPastWorkout, restStartTime, pausedRestTimer, pausedRestTimerValue]);

  const refreshActiveWorkout = async () => {
    // Only try to load active workout if user is logged in (has token)
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      return;
    }
    
    try {
      const workout = await apiClient.getActiveWorkout();
      setActiveWorkout(workout);
    } catch (error) {
      // Silently fail if user is not authenticated
      if (error instanceof Error && error.message === 'Unauthorized') {
        return;
      }
      console.error('Failed to refresh active workout:', error);
    }
  };

  const setActiveWorkoutDirectly = useCallback((workout: Workout, isPast?: boolean, pastDuration?: number) => {
    setActiveWorkout(workout);
    setIsPastWorkout(isPast ?? false);
    setPastWorkoutDuration(pastDuration ?? 0);

    // For past tracking the "total duration" is the user-entered historical value (not a live ticking timer).
    // Set workoutDuration to the provided past duration so that save paths (and anything reading the generic duration)
    // use the pre-specified time the user entered in the UI.
    setWorkoutDuration(pastDuration ?? 0);
    setPausedWorkoutDuration(null);
    setPausedRestTimer(null);
    setPausedRestTimerValue(null);
    setIsPaused(false);
    setIsRestTimerPaused(false);
    
    // Initialize workout timer only for non-past workouts
    if (!isPast) {
      const now = Date.now();
      setWorkoutStartTime(now);
      if (typeof window !== 'undefined') {
        localStorage.setItem('workoutStartTime', now.toString());
      }
    }

    // For past workout tracking we must never have an active live rest timer
    // (historical entry, not a real-time session). Clear any pending rest state
    // and localStorage to avoid leaking into a subsequent live workout.
    if (isPast) {
      setRestTimerStartedAt(null);
      setRestTimerTarget(0);
      setRestTimer(0);
      setRestStartTime(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('restStartTime');
        localStorage.removeItem('restTimerTarget');
      }
    }
  }, []);

  const startWorkout = async (data: {
    cycleId?: string;
    workoutDayId?: string;
    isFreeWorkout: boolean;
    homeGymId: string | null;
    isPastWorkout?: boolean;
    pastWorkoutDate?: string;
    pastWorkoutDuration?: number;
  }) => {
    setLoading(true);
    try {
      const workout = await apiClient.startWorkout(data);
      setActiveWorkout(workout);
      setIsPastWorkout(data.isPastWorkout ?? false);
      setPastWorkoutDuration(data.pastWorkoutDuration ?? 0);

      // For past tracking the "total duration" is the user-entered historical value (not a live ticking timer).
      // Set workoutDuration to the provided past duration so that save paths (and anything reading the generic duration)
      // use the pre-specified time the user entered in the UI.
      setWorkoutDuration(data.pastWorkoutDuration ?? 0);
      setPausedWorkoutDuration(null);
      setPausedRestTimer(null);
      setPausedRestTimerValue(null);
      setIsPaused(false);
      setIsRestTimerPaused(false);
      
      // Initialize workout timer
      if (!data.isPastWorkout) {
        const now = Date.now();
        setWorkoutStartTime(now);
        if (typeof window !== 'undefined') {
          localStorage.setItem('workoutStartTime', now.toString());
        }
      }

      // For past workout tracking we must never have an active live rest timer
      // (historical entry, not a real-time session). Clear any pending rest state
      // and localStorage to avoid leaking into a subsequent live workout.
      if (data.isPastWorkout) {
        setRestTimerStartedAt(null);
        setRestTimerTarget(0);
        setRestTimer(0);
        setRestStartTime(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('restStartTime');
          localStorage.removeItem('restTimerTarget');
        }
      }
    } catch (error) {
      console.error('Failed to start workout:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const completeWorkout = async (data?: {
    totalDuration?: number;
    updateBlueprint?: boolean;
  }): Promise<Workout | null> => {
    if (!activeWorkout) return null;

    setLoading(true);
    try {
      const completedWorkout = await apiClient.completeWorkout(activeWorkout.id, data);
      setActiveWorkout(null);
      setWorkoutDuration(0);
      setRestTimer(0);
      setRestTimerStartedAt(null);
      setRestTimerTarget(0);
      setWorkoutStartTime(null);
      setRestStartTime(null);
      setPausedWorkoutDuration(null);
      setPausedRestTimer(null);
      setPausedRestTimerValue(null);
      setIsPaused(false);
      setIsRestTimerPaused(false);
      
      // Clear localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('workoutStartTime');
        localStorage.removeItem('restStartTime');
        localStorage.removeItem('restTimerTarget');
      }
      
      return completedWorkout;
    } catch (error) {
      console.error('Failed to complete workout:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const discardWorkout = async () => {
    if (!activeWorkout) return;

    setLoading(true);
    try {
      await apiClient.discardWorkout(activeWorkout.id);
      setActiveWorkout(null);
      setWorkoutDuration(0);
      setRestTimer(0);
      setRestTimerStartedAt(null);
      setRestTimerTarget(0);
      setWorkoutStartTime(null);
      setRestStartTime(null);
      setPausedWorkoutDuration(null);
      setPausedRestTimer(null);
      setPausedRestTimerValue(null);
      setIsPaused(false);
      setIsRestTimerPaused(false);
      
      // Clear localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('workoutStartTime');
        localStorage.removeItem('restStartTime');
        localStorage.removeItem('restTimerTarget');
      }
    } catch (error) {
      console.error('Failed to discard workout:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const addExercise = async (exerciseId: string) => {
    if (!activeWorkout) return;

    if ((activeWorkout as any).blueprintEdit || activeWorkout.status === 'COMPLETED' || activeWorkout.status === 'DISCARDED') {
      // local add for history edit / completed via shared edit component
      try {
        const exDetails = await apiClient.getExercise(exerciseId);
        const newEx = {
          id: `local-ex-${Date.now()}`,
          exerciseId,
          exerciseName: exDetails.name || 'Exercise',
          isUnilateral: exDetails.isUnilateral,
          isDoubleWeight: exDetails.isDoubleWeight,
          order: (activeWorkout.exercises.length || 0) + 1,
          sets: [],
          plannedSets: [],
        };
        setActiveWorkout({
          ...activeWorkout,
          exercises: [...activeWorkout.exercises, newEx],
        } as Workout);
      } catch {
        // fallback stub
        const stub = {
          id: `local-ex-${Date.now()}`,
          exerciseId,
          exerciseName: 'Exercise',
          sets: [],
          order: (activeWorkout.exercises.length || 0) + 1,
        };
        setActiveWorkout({
          ...activeWorkout,
          exercises: [...activeWorkout.exercises, stub],
        } as Workout);
      }
      return;
    }

    setLoading(true);
    try {
      const workout = await apiClient.addExerciseToWorkout(
        activeWorkout.id,
        exerciseId
      );
      setActiveWorkout(workout);
    } catch (error) {
      console.error('Failed to add exercise:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const removeExercise = async (exerciseLogId: string) => {
    if (!activeWorkout) return;

    if ((activeWorkout as any).blueprintEdit || activeWorkout.status === 'COMPLETED' || activeWorkout.status === 'DISCARDED') {
      const updated = {
        ...activeWorkout,
        exercises: activeWorkout.exercises.filter((ex: { id: string }) => ex.id !== exerciseLogId),
      };
      setActiveWorkout(updated as Workout);
      return;
    }

    setLoading(true);
    try {
      const workout = await apiClient.removeExerciseFromWorkout(
        activeWorkout.id,
        exerciseLogId
      );
      setActiveWorkout(workout);
    } catch (error) {
      console.error('Failed to remove exercise:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const replaceExercise = async (exerciseLogId: string, newExerciseId: string) => {
    if (!activeWorkout) return;

    if ((activeWorkout as any).blueprintEdit || activeWorkout.status === 'COMPLETED' || activeWorkout.status === 'DISCARDED') {
      try {
        const exDetails = await apiClient.getExercise(newExerciseId);
        const updated = {
          ...activeWorkout,
          exercises: activeWorkout.exercises.map((ex: { id: string; sets?: unknown }) =>
            ex.id === exerciseLogId
              ? {
                  ...ex,
                  exerciseId: newExerciseId,
                  exerciseName: exDetails.name || 'Exercise',
                  sets: ex.sets || [],
                }
              : ex
          ),
        };
        setActiveWorkout(updated as Workout);
      } catch {
        const updated = {
          ...activeWorkout,
          exercises: activeWorkout.exercises.map((ex: { id: string; sets?: unknown }) =>
            ex.id === exerciseLogId
              ? { ...ex, exerciseId: newExerciseId, exerciseName: 'Exercise', sets: ex.sets || [] }
              : ex
          ),
        };
        setActiveWorkout(updated as Workout);
      }
      return;
    }

    setLoading(true);
    try {
      const workout = await apiClient.replaceExercise(
        activeWorkout.id,
        exerciseLogId,
        newExerciseId
      );
      setActiveWorkout(workout);
    } catch (error) {
      console.error('Failed to replace exercise:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const reorderExercises = async (exerciseIds: string[]) => {
    if (!activeWorkout) return;

    // Optimistic update (works for both active and completed/history edit)
    const reorderedExercises = exerciseIds
      .map(id => activeWorkout.exercises.find(ex => ex.id === id))
      .filter(Boolean) as typeof activeWorkout.exercises;

    setActiveWorkout({
      ...activeWorkout,
      exercises: reorderedExercises,
    });

    if ((activeWorkout as any).blueprintEdit || activeWorkout.status === 'COMPLETED' || activeWorkout.status === 'DISCARDED') {
      return; // no API for completed
    }

    try {
      const workout = await apiClient.reorderExercises(
        activeWorkout.id,
        exerciseIds
      );
      setActiveWorkout(workout);
    } catch (error) {
      console.error('Failed to reorder exercises:', error);
      // Revert on error
      await refreshActiveWorkout();
      throw error;
    }
  };

  const logSet = async (
    exerciseLogId: string,
    data: {
      setNumber: number;
      reps: number;
      weight: number;
      rir?: number;
      setType?: SetType;
      plannedRestAfterSet?: number;
    }
  ) => {
    if (!activeWorkout) return;

    // For completed workouts (e.g. history edit using the shared component in 'edit' mode),
    // perform local update only. Do not hit the active workout mutation APIs.
    // Persistence happens on the parent's explicit save via updateCompletedWorkout.
    if ((activeWorkout as any).blueprintEdit || activeWorkout.status === 'COMPLETED' || activeWorkout.status === 'DISCARDED') {
      const updatedExercises = activeWorkout.exercises.map((ex) => {
        if (ex.id !== exerciseLogId) return ex;

        const newSet = {
          id: `local-${Date.now()}-${data.setNumber}`,
          setNumber: data.setNumber,
          setType: data.setType || SetType.WORKING,
          reps: data.reps,
          weight: data.weight,
          rir: data.rir,
          restAfterSet: data.plannedRestAfterSet ?? 90,
          completedAt: new Date().toISOString(),
        };

        const existingIndex = ex.sets.findIndex((s) => s.setNumber === data.setNumber);
        let newSets = [...ex.sets];
        if (existingIndex >= 0) {
          newSets[existingIndex] = { ...newSets[existingIndex], ...newSet, id: newSets[existingIndex].id };
        } else {
          newSets = [...newSets, newSet].sort((a, b) => a.setNumber - b.setNumber);
        }
        return { ...ex, sets: newSets };
      });

      setActiveWorkout({ ...activeWorkout, exercises: updatedExercises } as Workout);
      // no rest timer side effects for completed
      return;
    }

    setLoading(true);
    try {
      // Calculate actual rest duration if timer was running
      const actualRestDuration = restTimerStartedAt !== null ? restTimer : undefined;

      const workout = await apiClient.logSet(
        activeWorkout.id,
        exerciseLogId,
        {
          setNumber: data.setNumber,
          reps: data.reps,
          weight: data.weight,
          rir: data.rir,
          setType: data.setType,
          actualRestDuration,
          // Send the intended rest after set (default 90s for additional sets and for past/historical tracking).
          // This ensures that when saving a past-tracked workout the set pauses are recorded.
          restAfterSet: data.plannedRestAfterSet ?? 90,
        }
      );
      setActiveWorkout(workout);

      // Start new rest timer with this set's planned rest duration.
      // IMPORTANT: Never start live rest timer for past workout tracking (historical data entry)
      // or blueprint-style edits. Rest timer is only for real-time active sessions.
      if (!isPastWorkout && data.plannedRestAfterSet !== undefined && data.plannedRestAfterSet > 0) {
        const now = Date.now();
        setRestTimerStartedAt(now);
        setRestStartTime(now);
        setRestTimerTarget(data.plannedRestAfterSet);
        setRestTimer(0);
        setIsRestTimerPaused(false);
        setPausedRestTimerValue(null);
        
        // Persist to localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('restStartTime', now.toString());
          localStorage.setItem('restTimerTarget', data.plannedRestAfterSet.toString());
        }
      }
    } catch (error) {
      console.error('Failed to log set:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteSet = async (setLogId: string) => {
    if (!activeWorkout) return;

    if ((activeWorkout as any).blueprintEdit || activeWorkout.status === 'COMPLETED' || activeWorkout.status === 'DISCARDED') {
      const updatedExercises = activeWorkout.exercises.map((ex) => ({
        ...ex,
        sets: ex.sets.filter((s) => s.id !== setLogId),
      }));
      setActiveWorkout({ ...activeWorkout, exercises: updatedExercises } as Workout);
      return;
    }

    setLoading(true);
    try {
      const workout = await apiClient.deleteSet(
        activeWorkout.id,
        setLogId
      );
      setActiveWorkout(workout);
    } catch (error) {
      console.error('Failed to delete set:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateSet = async (
    setLogId: string,
    data: {
      reps: number;
      weight: number;
      rir?: number;
    }
  ) => {
    if (!activeWorkout) return;

    if ((activeWorkout as any).blueprintEdit || activeWorkout.status === 'COMPLETED' || activeWorkout.status === 'DISCARDED') {
      // local update for completed (history edit via shared component)
      const updatedExercises = activeWorkout.exercises.map((ex) => ({
        ...ex,
        sets: ex.sets.map((s) => (s.id === setLogId ? { ...s, ...data } : s)),
      }));
      setActiveWorkout({ ...activeWorkout, exercises: updatedExercises } as Workout);
      return;
    }

    setLoading(true);
    try {
      const workout = await apiClient.updateSet(
        activeWorkout.id,
        setLogId,
        data
      );
      setActiveWorkout(workout);
    } catch (error) {
      console.error('Failed to update set:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const initTemplateSave = (workoutId: string) => {
    setPendingTemplateSave({ workoutId });
  };

  const cancelTemplateSave = () => {
    setPendingTemplateSave(null);
  };

  const completeTemplateSave = () => {
    setPendingTemplateSave(null);
  };

  // Restore timers from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedWorkoutStartTime = localStorage.getItem('workoutStartTime');
      const savedRestStartTime = localStorage.getItem('restStartTime');
      const savedRestTarget = localStorage.getItem('restTimerTarget');

      if (savedWorkoutStartTime) {
        setWorkoutStartTime(parseInt(savedWorkoutStartTime));
      }

      if (savedRestStartTime) {
        setRestStartTime(parseInt(savedRestStartTime));
        setRestTimerStartedAt(parseInt(savedRestStartTime));
        if (savedRestTarget) {
          setRestTimerTarget(parseInt(savedRestTarget));
        }
      }
    }
  }, []);

  useEffect(() => {
    // Load active workout on mount
    refreshActiveWorkout();
  }, []);

  return (
    <WorkoutContext.Provider
      value={{
        activeWorkout,
        loading,
        isPaused,
        togglePause,
        isRestTimerPaused,
        toggleRestTimerPause,
        isPastWorkout,
        pastWorkoutDuration,
        setPastWorkoutDuration,
        startWorkout,
        completeWorkout,
        discardWorkout,
        addExercise,
        removeExercise,
        replaceExercise,
        reorderExercises,
        logSet,
        deleteSet,
        updateSet,
        refreshActiveWorkout,
        setActiveWorkoutDirectly,
        workoutDuration,
        restTimer,
        restTimerTarget,
        pendingTemplateSave,
        initTemplateSave,
        cancelTemplateSave,
        completeTemplateSave,
      }}
    >
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkout() {
  const context = useContext(WorkoutContext);
  if (context === undefined) {
    throw new Error('useWorkout must be used within a WorkoutProvider');
  }
  return context;
}
