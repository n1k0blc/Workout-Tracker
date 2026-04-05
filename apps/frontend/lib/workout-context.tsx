'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Workout, SetType, GymLocation } from '@/types';
import { apiClient } from '@/lib/api';

interface WorkoutContextType {
  activeWorkout: Workout | null;
  loading: boolean;
  isPaused: boolean;
  togglePause: () => void;
  isPastWorkout: boolean;
  pastWorkoutDuration: number;
  setPastWorkoutDuration: (duration: number) => void;
  removedPlannedSets: Map<string, Set<number>>; // exerciseLogId -> set of setNumbers that were removed
  markPlannedSetAsRemoved: (exerciseLogId: string, setNumber: number) => void;
  unplannedSets: Map<string, Set<number>>; // exerciseLogId -> set of setNumbers for unplanned sets
  addUnplannedSet: (exerciseLogId: string, setNumber: number) => void;
  removeUnplannedSet: (exerciseLogId: string, setNumber: number) => void;
  startWorkout: (data: {
    cycleId?: string;
    workoutDayId?: string;
    isFreeWorkout: boolean;
    gymLocation: GymLocation;
    isPastWorkout?: boolean;
    pastWorkoutDate?: string;
    pastWorkoutDuration?: number;
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
  const [isPaused, setIsPaused] = useState(false);
  const [isPastWorkout, setIsPastWorkout] = useState(false);
  const [pastWorkoutDuration, setPastWorkoutDuration] = useState(0);
  const [removedPlannedSets, setRemovedPlannedSets] = useState<Map<string, Set<number>>>(new Map());
  const [unplannedSets, setUnplannedSets] = useState<Map<string, Set<number>>>(new Map());
  const [workoutDuration, setWorkoutDuration] = useState(0);
  const [restTimer, setRestTimer] = useState(0); // Elapsed seconds
  const [restTimerTarget, setRestTimerTarget] = useState(0); // Target seconds
  const [restTimerStartedAt, setRestTimerStartedAt] = useState<number | null>(null);
  const [showRestAlert, setShowRestAlert] = useState(false);
  
  // Timestamp-based timers (stored in localStorage for persistence)
  const [workoutStartTime, setWorkoutStartTime] = useState<number | null>(null);
  const [restStartTime, setRestStartTime] = useState<number | null>(null);

  const workoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const restTimerRef = useRef<NodeJS.Timeout | null>(null);

  const togglePause = () => {
    setIsPaused(prev => !prev);
  };

  const markPlannedSetAsRemoved = (exerciseLogId: string, setNumber: number) => {
    setRemovedPlannedSets(prev => {
      const newMap = new Map(prev);
      const exerciseSet = newMap.get(exerciseLogId) || new Set();
      exerciseSet.add(setNumber);
      newMap.set(exerciseLogId, exerciseSet);
      return newMap;
    });
  };

  const addUnplannedSet = (exerciseLogId: string, setNumber: number) => {
    setUnplannedSets(prev => {
      const newMap = new Map(prev);
      const exerciseSet = newMap.get(exerciseLogId) || new Set();
      exerciseSet.add(setNumber);
      newMap.set(exerciseLogId, exerciseSet);
      return newMap;
    });
  };

  const removeUnplannedSet = (exerciseLogId: string, setNumber: number) => {
    setUnplannedSets(prev => {
      const newMap = new Map(prev);
      const exerciseSet = newMap.get(exerciseLogId);
      if (exerciseSet) {
        exerciseSet.delete(setNumber);
        if (exerciseSet.size === 0) {
          newMap.delete(exerciseLogId);
        } else {
          newMap.set(exerciseLogId, exerciseSet);
        }
      }
      return newMap;
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
      // Reset timer when no active workout
      if (!activeWorkout) {
        setWorkoutDuration(0);
        setWorkoutStartTime(null);
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
  }, [activeWorkout, isPaused, isPastWorkout, workoutStartTime]);

  // Rest Timer (timestamp-based, persists across tab switches)
  useEffect(() => {
    if (restTimerStartedAt !== null && !isPaused && !isPastWorkout) {
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
          
          // Show alert when target time is reached
          if (elapsed === restTimerTarget && restTimerTarget > 0 && !showRestAlert) {
            setShowRestAlert(true);
          }
        }
      }, 100);
    } else {
      if (restTimerRef.current) {
        clearInterval(restTimerRef.current);
        restTimerRef.current = null;
      }
      // Reset rest timer when stopped
      if (restTimerStartedAt === null) {
        setRestTimer(0);
        setRestStartTime(null);
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
  }, [restTimerStartedAt, restTimerTarget, isPaused, isPastWorkout, restStartTime, showRestAlert]);

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
    gymLocation: GymLocation;
    isPastWorkout?: boolean;
    pastWorkoutDate?: string;
    pastWorkoutDuration?: number;
  }) => {
    setLoading(true);
    try {
      const workout = await apiClient.startWorkout(data);
      setActiveWorkout(workout);
      setWorkoutDuration(0);
      setIsPastWorkout(data.isPastWorkout ?? false);
      setPastWorkoutDuration(data.pastWorkoutDuration ?? 0);
      setRemovedPlannedSets(new Map()); // Reset removed sets for new workout
      setUnplannedSets(new Map()); // Reset unplanned sets for new workout
      
      // Initialize workout timer
      if (!data.isPastWorkout) {
        const now = Date.now();
        setWorkoutStartTime(now);
        if (typeof window !== 'undefined') {
          localStorage.setItem('workoutStartTime', now.toString());
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
      setWorkoutStartTime(null);
      setRestStartTime(null);
      
      // Clear localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('workoutStartTime');
        localStorage.removeItem('restStartTime');
        localStorage.removeItem('restTimerTarget');
      }
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
      setWorkoutStartTime(null);
      setRestStartTime(null);
      
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
        const now = Date.now();
        setRestTimerStartedAt(now);
        setRestStartTime(now);
        setRestTimerTarget(data.plannedRestAfterSet);
        setRestTimer(0);
        setShowRestAlert(false);
        
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
        isPastWorkout,
        pastWorkoutDuration,
        setPastWorkoutDuration,
        removedPlannedSets,
        markPlannedSetAsRemoved,
        unplannedSets,
        addUnplannedSet,
        removeUnplannedSet,
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
