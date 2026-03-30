'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Workout, SetType } from '@/types';
import { apiClient } from '@/lib/api';

interface WorkoutContextType {
  activeWorkout: Workout | null;
  loading: boolean;
  startWorkout: (data: {
    cycleId?: string;
    workoutDayId?: string;
    isFreeWorkout: boolean;
  }) => Promise<void>;
  completeWorkout: (data?: {
    totalDuration?: number;
    updateBlueprint?: boolean;
  }) => Promise<void>;
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
  workoutDuration: number;
  restTimer: number; // Elapsed seconds since rest started
  restTimerTarget: number; // Target rest duration in seconds
  showRestAlert: boolean;
  dismissRestAlert: () => void;
}

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(false);
  const [workoutDuration, setWorkoutDuration] = useState(0);
  const [restTimer, setRestTimer] = useState(0); // Elapsed seconds
  const [restTimerTarget, setRestTimerTarget] = useState(0); // Target seconds
  const [restTimerStartedAt, setRestTimerStartedAt] = useState<number | null>(null);
  const [showRestAlert, setShowRestAlert] = useState(false);

  const workoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const restTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Workout Duration Timer
  useEffect(() => {
    if (activeWorkout && activeWorkout.status === 'IN_PROGRESS') {
      workoutTimerRef.current = setInterval(() => {
        setWorkoutDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (workoutTimerRef.current) {
        clearInterval(workoutTimerRef.current);
        workoutTimerRef.current = null;
      }
      setWorkoutDuration(0);
    }

    return () => {
      if (workoutTimerRef.current) {
        clearInterval(workoutTimerRef.current);
      }
    };
  }, [activeWorkout]);

  // Rest Timer (Stopwatch - counts UP)
  useEffect(() => {
    if (restTimerStartedAt !== null) {
      restTimerRef.current = setInterval(() => {
        setRestTimer((prev) => {
          const newValue = prev + 1;
          // Show alert when target time is reached
          if (newValue === restTimerTarget && restTimerTarget > 0) {
            setShowRestAlert(true);
          }
          return newValue;
        });
      }, 1000);
    } else {
      if (restTimerRef.current) {
        clearInterval(restTimerRef.current);
        restTimerRef.current = null;
      }
      setRestTimer(0);
    }

    return () => {
      if (restTimerRef.current) {
        clearInterval(restTimerRef.current);
      }
    };
  }, [restTimerStartedAt, restTimerTarget]);

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

  const startWorkout = async (data: {
    cycleId?: string;
    workoutDayId?: string;
    isFreeWorkout: boolean;
  }) => {
    setLoading(true);
    try {
      const workout = await apiClient.startWorkout(data);
      setActiveWorkout(workout);
      setWorkoutDuration(0);
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
  }) => {
    if (!activeWorkout) return;

    setLoading(true);
    try {
      await apiClient.completeWorkout(activeWorkout.id, data);
      setActiveWorkout(null);
      setWorkoutDuration(0);
      setRestTimer(0);
      setRestTimerStartedAt(null);
      setRestTimerTarget(0);
      setShowRestAlert(false);
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
      setShowRestAlert(false);
    } catch (error) {
      console.error('Failed to discard workout:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const addExercise = async (exerciseId: string) => {
    if (!activeWorkout) return;

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

    // Optimistic update
    const reorderedExercises = exerciseIds
      .map(id => activeWorkout.exercises.find(ex => ex.id === id))
      .filter(Boolean) as typeof activeWorkout.exercises;

    setActiveWorkout({
      ...activeWorkout,
      exercises: reorderedExercises,
    });

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
        }
      );
      setActiveWorkout(workout);

      // Start new rest timer with this set's planned rest duration
      if (data.plannedRestAfterSet !== undefined && data.plannedRestAfterSet > 0) {
        setRestTimerStartedAt(Date.now());
        setRestTimerTarget(data.plannedRestAfterSet);
        setRestTimer(0);
        setShowRestAlert(false);
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

  const dismissRestAlert = () => {
    setShowRestAlert(false);
  };

  useEffect(() => {
    // Load active workout on mount
    refreshActiveWorkout();
  }, []);

  return (
    <WorkoutContext.Provider
      value={{
        activeWorkout,
        loading,
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
        workoutDuration,
        restTimer,
        restTimerTarget,
        showRestAlert,
        dismissRestAlert,
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
