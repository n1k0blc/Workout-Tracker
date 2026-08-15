'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Workout, WorkoutExercise, ExerciseLog, SetLog, PlannedSet, SetType, SaveAsTemplateMode, WorkoutExerciseInput, Exercise } from '@/types';
import { apiClient } from '@/lib/api';
import { reorderExerciseLogs, toExercisePayload } from '@/lib/workout-order';
import { replaceExerciseInList } from '@/lib/exercise-replace';
import { toLocalDateString } from '@/lib/local-date';

const DRAFT_STORAGE_KEY = 'activeWorkoutDraft';
const DRAFT_META_STORAGE_KEY = 'activeWorkoutDraftMeta';

interface DraftMeta {
  isPastWorkout: boolean;
  pastWorkoutDuration: number;
  isHistoryEdit: boolean;
  existingWorkoutId: string | null;
}

/** One entry per set actually logged during a *live* session, in completion order. Drives
 *  rest-attribution (§3.5): when a new set completes, the previous entry's set gets its `rest`
 *  assigned as the measured gap. The last entry in the whole workout never gets a follow-up,
 *  so its `rest` is defaulted (planned/90) only at save time. */
interface CompletionEntry {
  exerciseLogId: string;
  setLogId: string;
  at: number; // epoch ms
}

export interface CompleteWorkoutOptions {
  /**
   * A day correction made on the save screen itself (history editor). Passed through the
   * save call rather than staged into `activeWorkout` first: a state write in the same tick
   * as the save is invisible to it, so the correction would be silently dropped.
   */
  dateOverride?: { date: string; localDate: string };
  overwriteBlueprint?: boolean;
  saveAsTemplateMode?: SaveAsTemplateMode;
  saveAsTemplateName?: string;
  overwriteTemplateId?: string;
}

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
  /** Editing an already-saved workout (history edit): values-only, no rest computation, saves via update. */
  isHistoryEdit: boolean;
  startWorkout: (data: {
    cycleId?: string;
    workoutDayId?: string;
    isFreeWorkout: boolean;
    homeGymId: string | null;
    isPastWorkout?: boolean;
    pastWorkoutDate?: string;
    pastWorkoutDuration?: number;
  }) => Promise<void>;
  startWorkoutFromTemplate: (
    templateId: string,
    homeGymId: string | null,
    isPastWorkout?: boolean,
    pastWorkoutDate?: string,
    pastWorkoutDuration?: number,
  ) => Promise<void>;
  loadWorkoutForEdit: (workoutId: string) => Promise<void>;
  completeWorkout: (options?: CompleteWorkoutOptions) => Promise<Workout | null>;
  discardWorkout: () => void;
  addExercise: (exerciseId: string) => Promise<string>;
  removeExercise: (exerciseLogId: string) => Promise<void>;
  replaceExercise: (exerciseLogId: string, newExerciseId: string, newExercise?: Exercise) => Promise<void>;
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
      reps?: number;
      weight?: number;
      rir?: number;
      setType?: SetType;
    }
  ) => Promise<void>;
  setActiveWorkoutDirectly: (workout: Workout | null, isPastWorkout?: boolean, pastWorkoutDuration?: number) => void;
  workoutDuration: number;
  restTimer: number;
  restTimerTarget: number;
}

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

function generateLocalId(prefix: string): string {
  return `local-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isRestTimerPaused, setIsRestTimerPaused] = useState(false);
  const [isPastWorkout, setIsPastWorkout] = useState(false);
  const [pastWorkoutDuration, setPastWorkoutDuration] = useState(0);
  const [isHistoryEdit, setIsHistoryEdit] = useState(false);
  const [workoutDuration, setWorkoutDuration] = useState(0);
  const [restTimer, setRestTimer] = useState(0);
  const [restTimerTarget, setRestTimerTarget] = useState(0);
  const [restTimerStartedAt, setRestTimerStartedAt] = useState<number | null>(null);

  // Timestamp-based timers (stored in localStorage for persistence)
  const [workoutStartTime, setWorkoutStartTime] = useState<number | null>(null);
  const workoutStartTimeRef = useRef<number | null>(null);
  const [restStartTime, setRestStartTime] = useState<number | null>(null);

  // Pause state - stores elapsed time when paused
  const [pausedWorkoutDuration, setPausedWorkoutDuration] = useState<number | null>(null);
  const [pausedRestTimer, setPausedRestTimer] = useState<number | null>(null);
  const [pausedRestTimerValue, setPausedRestTimerValue] = useState<number | null>(null);

  const workoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const restTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Existing workout being edited (history edit) -- save calls update, not create.
  const existingWorkoutIdRef = useRef<string | null>(null);
  // Rest-attribution completion log (live sessions only -- see CompletionEntry).
  const completionLogRef = useRef<CompletionEntry[]>([]);

  useEffect(() => {
    workoutStartTimeRef.current = workoutStartTime;
  }, [workoutStartTime]);

  const persistDraft = useCallback((workout: Workout | null, meta: DraftMeta | null) => {
    if (typeof window === 'undefined') return;
    if (!workout || !meta) {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      localStorage.removeItem(DRAFT_META_STORAGE_KEY);
      return;
    }
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(workout));
    localStorage.setItem(DRAFT_META_STORAGE_KEY, JSON.stringify(meta));
  }, []);

  const togglePause = () => {
    setIsPaused(prev => {
      const newPausedState = !prev;

      if (newPausedState) {
        setPausedWorkoutDuration(workoutDuration);
        setPausedRestTimer(restTimer);
      } else {
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
        setPausedRestTimerValue(restTimer);
      } else {
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
    if (activeWorkout && !isHistoryEdit && !isPaused && !isPastWorkout) {
      if (workoutStartTime === null) {
        const now = Date.now();
        setWorkoutStartTime(now);
        if (typeof window !== 'undefined') {
          localStorage.setItem('workoutStartTime', now.toString());
        }
      }

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

      if (isPaused && pausedWorkoutDuration !== null) {
        setWorkoutDuration(pausedWorkoutDuration);
      }

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
  }, [activeWorkout, isHistoryEdit, isPaused, isPastWorkout, workoutStartTime, pausedWorkoutDuration]);

  // Rest Timer (timestamp-based, persists across tab switches)
  useEffect(() => {
    if (restTimerStartedAt !== null && !isPaused && !isRestTimerPaused && !isPastWorkout) {
      if (restStartTime === null) {
        setRestStartTime(restTimerStartedAt);
        if (typeof window !== 'undefined') {
          localStorage.setItem('restStartTime', restTimerStartedAt.toString());
          localStorage.setItem('restTimerTarget', restTimerTarget.toString());
        }
      }

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

      if (isPaused && pausedRestTimer !== null) {
        setRestTimer(pausedRestTimer);
      }

      if (isRestTimerPaused && pausedRestTimerValue !== null) {
        setRestTimer(pausedRestTimerValue);
      }

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

  const clearAllTimerState = () => {
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
    if (typeof window !== 'undefined') {
      localStorage.removeItem('workoutStartTime');
      localStorage.removeItem('restStartTime');
      localStorage.removeItem('restTimerTarget');
    }
  };

  const setActiveWorkoutDirectly = useCallback((workout: Workout | null, isPast?: boolean, pastDuration?: number) => {
    if (!workout) {
      setActiveWorkout(null);
      setIsPastWorkout(false);
      setPastWorkoutDuration(0);
      setIsHistoryEdit(false);
      existingWorkoutIdRef.current = null;
      completionLogRef.current = [];
      clearAllTimerState();
      persistDraft(null, null);
      return;
    }

    setActiveWorkout(workout);
    setIsPastWorkout(isPast ?? false);
    setPastWorkoutDuration(pastDuration ?? 0);
    setWorkoutDuration(pastDuration ?? 0);
    setPausedWorkoutDuration(null);
    setPausedRestTimer(null);
    setPausedRestTimerValue(null);
    setIsPaused(false);
    setIsRestTimerPaused(false);

    const isLiveSession = !isPast && !isHistoryEdit;
    if (isLiveSession) {
      if (workoutStartTimeRef.current === null) {
        const now = Date.now();
        setWorkoutStartTime(now);
        if (typeof window !== 'undefined') {
          localStorage.setItem('workoutStartTime', now.toString());
        }
      }
    }

    if (isPast || isHistoryEdit) {
      setRestTimerStartedAt(null);
      setRestTimerTarget(0);
      setRestTimer(0);
      setRestStartTime(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('restStartTime');
        localStorage.removeItem('restTimerTarget');
      }
    }

    persistDraft(workout, {
      isPastWorkout: isPast ?? false,
      pastWorkoutDuration: pastDuration ?? 0,
      isHistoryEdit,
      existingWorkoutId: existingWorkoutIdRef.current,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHistoryEdit, persistDraft]);

  /** Builds the local draft's ExerciseLog[] from a blueprint/template exercise tree. */
  const buildExerciseLogsFromTree = (
    exercises: { exerciseId: string; exerciseName: string; isUnilateral?: boolean; isDoubleWeight?: boolean; order: number; sets: { order: number; setType: SetType; reps: number; weight: number; rir?: number; rest?: number }[] }[],
  ): ExerciseLog[] => {
    return exercises.map((ex) => ({
      id: generateLocalId('ex'),
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      isUnilateral: ex.isUnilateral,
      isDoubleWeight: ex.isDoubleWeight,
      order: ex.order,
      sets: [],
      plannedSets: ex.sets.map((s): PlannedSet => ({
        id: generateLocalId('planned'),
        order: s.order,
        setType: s.setType,
        reps: s.reps,
        weight: s.weight,
        rir: s.rir ?? 0,
        rest: s.rest ?? 90,
      })),
    }));
  };

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
      let exercises: ExerciseLog[] = [];

      if (!data.isFreeWorkout && data.cycleId && data.workoutDayId) {
        const cycle = await apiClient.getCycle(data.cycleId);
        const day = cycle.workoutDays.find((d) => d.id === data.workoutDayId);
        if (day?.blueprint?.exercises) {
          exercises = buildExerciseLogsFromTree(day.blueprint.exercises);
        }
      }

      const workout: Workout = {
        id: generateLocalId('workout'),
        date: data.isPastWorkout && data.pastWorkoutDate ? data.pastWorkoutDate : new Date().toISOString(),
        // A picked past date is already a local calendar day -- stored verbatim. A live
        // session's day is re-stamped when it is finished (see completeWorkout).
        localDate: data.isPastWorkout && data.pastWorkoutDate ? data.pastWorkoutDate : toLocalDateString(new Date()),
        isFreeWorkout: data.isFreeWorkout,
        homeGymId: data.homeGymId,
        cycleId: data.cycleId,
        workoutDayId: data.workoutDayId,
        exercises,
        createdAt: new Date().toISOString(),
      };

      existingWorkoutIdRef.current = null;
      completionLogRef.current = [];
      setIsHistoryEdit(false);
      setActiveWorkoutDirectly(workout, data.isPastWorkout, data.pastWorkoutDuration);
    } catch (error) {
      console.error('Failed to start workout:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const startWorkoutFromTemplate = async (
    templateId: string,
    homeGymId: string | null,
    isPast?: boolean,
    pastWorkoutDate?: string,
    pastWorkoutDuration?: number,
  ) => {
    setLoading(true);
    try {
      const template = await apiClient.getWorkoutTemplate(templateId);
      const exercises = buildExerciseLogsFromTree(template.exercises ?? []);

      const workout: Workout = {
        id: generateLocalId('workout'),
        date: isPast && pastWorkoutDate ? pastWorkoutDate : new Date().toISOString(),
        localDate: isPast && pastWorkoutDate ? pastWorkoutDate : toLocalDateString(new Date()),
        isFreeWorkout: true,
        homeGymId: homeGymId ?? template.recommendedGymId ?? null,
        originTemplateId: template.id,
        originTemplateName: template.name,
        originTemplateIsCustom: template.isCustom,
        exercises,
        createdAt: new Date().toISOString(),
      };

      existingWorkoutIdRef.current = null;
      completionLogRef.current = [];
      setIsHistoryEdit(false);
      setActiveWorkoutDirectly(workout, isPast, pastWorkoutDuration);
    } catch (error) {
      console.error('Failed to start workout from template:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loadWorkoutForEdit = async (workoutId: string) => {
    setLoading(true);
    try {
      const workout = await apiClient.getWorkout(workoutId);
      // Server tree only has confirmed sets -- map straight into `sets` (no plannedSets;
      // values-only editing, no logging concept).
      const rawExercises = workout.exercises as unknown as WorkoutExercise[];
      const exercises: ExerciseLog[] = rawExercises.map((ex) => ({
        ...ex,
        sets: ex.sets.map((s): SetLog => ({
          id: s.id,
          setNumber: s.order,
          setType: s.setType,
          reps: s.reps,
          weight: s.weight,
          rir: s.rir,
          rest: s.rest,
          completedAt: s.completedAt ?? new Date().toISOString(),
        })),
        plannedSets: undefined,
      }));

      existingWorkoutIdRef.current = workoutId;
      completionLogRef.current = [];
      setIsHistoryEdit(true);
      setActiveWorkoutDirectly({ ...workout, exercises }, false, workout.totalDuration ?? 0);
    } catch (error) {
      console.error('Failed to load workout for edit:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const completeWorkout = async (options: CompleteWorkoutOptions = {}): Promise<Workout | null> => {
    if (!activeWorkout) return null;

    setLoading(true);
    try {
      const isLive = !isPastWorkout && !isHistoryEdit;

      // Finalize rest-attribution for the last completed set of a live session (§3.5):
      // it never got a follow-up completion to measure against, so fall back to its
      // planned rest value (or 90).
      let exercises = activeWorkout.exercises;
      if (isLive && completionLogRef.current.length > 0) {
        const last = completionLogRef.current[completionLogRef.current.length - 1];
        exercises = exercises.map((ex) => {
          if (ex.id !== last.exerciseLogId) return ex;
          return {
            ...ex,
            sets: ex.sets.map((s) => {
              if (s.id !== last.setLogId || s.rest !== undefined) return s;
              const planned = ex.plannedSets?.find((ps) => ps.order === s.setNumber);
              return { ...s, rest: planned?.rest ?? 90 };
            }),
          };
        });
      }

      const exerciseInputs: WorkoutExerciseInput[] = toExercisePayload(exercises);

      const totalDuration = isPastWorkout ? pastWorkoutDuration : workoutDuration;

      // A live session is stamped with the day it is *finished* on -- a session started at
      // 23:50 belongs to the day it ended. A past entry and a history edit keep the day they
      // already carry (picked by the user, or loaded from the server).
      const localDate = isLive
        ? toLocalDateString(new Date())
        : options.dateOverride?.localDate ?? activeWorkout.localDate;

      const payload = {
        date: options.dateOverride?.date ?? activeWorkout.date,
        localDate,
        totalDuration,
        isFreeWorkout: activeWorkout.isFreeWorkout,
        homeGymId: activeWorkout.homeGymId ?? undefined,
        cycleId: activeWorkout.cycleId,
        workoutDayId: activeWorkout.workoutDayId,
        originTemplateId: activeWorkout.originTemplateId,
        exercises: exerciseInputs,
        overwriteBlueprint: options.overwriteBlueprint,
        saveAsTemplateMode: options.saveAsTemplateMode,
        saveAsTemplateName: options.saveAsTemplateName,
        overwriteTemplateId: options.overwriteTemplateId,
      };

      const saved = existingWorkoutIdRef.current
        ? await apiClient.updateWorkout(existingWorkoutIdRef.current, payload)
        : await apiClient.createWorkout(payload);

      existingWorkoutIdRef.current = null;
      completionLogRef.current = [];
      setActiveWorkout(null);
      setIsHistoryEdit(false);
      clearAllTimerState();
      persistDraft(null, null);

      return saved;
    } catch (error) {
      console.error('Failed to complete workout:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const discardWorkout = () => {
    existingWorkoutIdRef.current = null;
    completionLogRef.current = [];
    setActiveWorkout(null);
    setIsHistoryEdit(false);
    clearAllTimerState();
    persistDraft(null, null);
  };

  const addExercise = async (exerciseId: string) => {
    if (!activeWorkout) return '';

    try {
      const exDetails = await apiClient.getExercise(exerciseId);
      const newEx: ExerciseLog = {
        id: generateLocalId('ex'),
        exerciseId,
        exerciseName: exDetails.name || 'Exercise',
        isUnilateral: exDetails.isUnilateral,
        isDoubleWeight: exDetails.isDoubleWeight,
        order: (activeWorkout.exercises.length || 0) + 1,
        sets: [],
        plannedSets: [],
      };
      setActiveWorkoutDirectly({ ...activeWorkout, exercises: [...activeWorkout.exercises, newEx] }, isPastWorkout, pastWorkoutDuration);
      return newEx.id;
    } catch (error) {
      console.error('Failed to add exercise:', error);
      const stub: ExerciseLog = {
        id: generateLocalId('ex'),
        exerciseId,
        exerciseName: 'Exercise',
        sets: [],
        order: (activeWorkout.exercises.length || 0) + 1,
      };
      setActiveWorkoutDirectly({ ...activeWorkout, exercises: [...activeWorkout.exercises, stub] }, isPastWorkout, pastWorkoutDuration);
      return stub.id;
    }
  };

  const removeExercise = async (exerciseLogId: string) => {
    if (!activeWorkout) return;
    setActiveWorkoutDirectly(
      { ...activeWorkout, exercises: activeWorkout.exercises.filter((ex) => ex.id !== exerciseLogId) },
      isPastWorkout,
      pastWorkoutDuration,
    );
  };

  const replaceExercise = async (exerciseLogId: string, newExerciseId: string, newExercise?: Exercise) => {
    if (!activeWorkout) return;

    try {
      // The picker already handed us the entry it selected; only fall back to the API when it didn't.
      const exDetails = newExercise ?? await apiClient.getExercise(newExerciseId);
      const updated = {
        ...activeWorkout,
        exercises: replaceExerciseInList(activeWorkout.exercises, exerciseLogId, {
          id: newExerciseId,
          name: exDetails.name,
          isUnilateral: exDetails.isUnilateral,
          isDoubleWeight: exDetails.isDoubleWeight,
        }),
      };
      setActiveWorkoutDirectly(updated, isPastWorkout, pastWorkoutDuration);
    } catch (error) {
      console.error('Failed to replace exercise:', error);
    }
  };

  const reorderExercises = async (exerciseIds: string[]) => {
    if (!activeWorkout) return;

    const reordered = reorderExerciseLogs(activeWorkout.exercises, exerciseIds);

    setActiveWorkoutDirectly({ ...activeWorkout, exercises: reordered }, isPastWorkout, pastWorkoutDuration);
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

    const isLive = !isPastWorkout && !isHistoryEdit;
    const now = Date.now();
    const newSetId = generateLocalId('set');

    // Past-tracking/history-edit: no real elapsed time to measure -- always use the planned/90
    // fallback directly (§3.5). Live: leave rest undefined; it gets filled in when the NEXT set
    // completes (assigned to the set that was previously last), or at save time if this is final.
    const newSet: SetLog = {
      id: newSetId,
      setNumber: data.setNumber,
      setType: data.setType || SetType.WORKING,
      reps: data.reps,
      weight: data.weight,
      rir: data.rir,
      completedAt: new Date(now).toISOString(),
      rest: isLive ? undefined : (data.plannedRestAfterSet ?? 90),
    };

    let exercises = activeWorkout.exercises.map((ex) => {
      if (ex.id !== exerciseLogId) return ex;
      const existingIndex = ex.sets.findIndex((s) => s.setNumber === data.setNumber);
      let newSets = [...ex.sets];
      if (existingIndex >= 0) {
        newSets[existingIndex] = { ...newSets[existingIndex], ...newSet, id: newSets[existingIndex].id };
      } else {
        newSets = [...newSets, newSet].sort((a, b) => a.setNumber - b.setNumber);
      }
      return { ...ex, sets: newSets };
    });

    if (isLive) {
      const previous = completionLogRef.current[completionLogRef.current.length - 1];
      if (previous) {
        const restSeconds = Math.max(0, Math.round((now - previous.at) / 1000));
        exercises = exercises.map((ex) => {
          if (ex.id !== previous.exerciseLogId) return ex;
          return {
            ...ex,
            sets: ex.sets.map((s) => (s.id === previous.setLogId ? { ...s, rest: restSeconds } : s)),
          };
        });
      }
      completionLogRef.current = [...completionLogRef.current, { exerciseLogId, setLogId: newSetId, at: now }];
    }

    setActiveWorkoutDirectly({ ...activeWorkout, exercises }, isPastWorkout, pastWorkoutDuration);

    // Rest-timer display (UX feedback only -- the actual persisted `rest` value is the real
    // measured gap computed above, not this countdown target).
    if (isLive && data.plannedRestAfterSet !== undefined && data.plannedRestAfterSet > 0) {
      setRestTimerStartedAt(now);
      setRestStartTime(now);
      setRestTimerTarget(data.plannedRestAfterSet);
      setRestTimer(0);
      setIsRestTimerPaused(false);
      setPausedRestTimerValue(null);
      if (typeof window !== 'undefined') {
        localStorage.setItem('restStartTime', now.toString());
        localStorage.setItem('restTimerTarget', data.plannedRestAfterSet.toString());
      }
    }
  };

  const deleteSet = async (setLogId: string) => {
    if (!activeWorkout) return;

    completionLogRef.current = completionLogRef.current.filter((e) => e.setLogId !== setLogId);

    const updatedExercises = activeWorkout.exercises.map((ex) => ({
      ...ex,
      sets: ex.sets.filter((s) => s.id !== setLogId),
    }));
    setActiveWorkoutDirectly({ ...activeWorkout, exercises: updatedExercises }, isPastWorkout, pastWorkoutDuration);
  };

  const updateSet = async (
    setLogId: string,
    data: {
      reps?: number;
      weight?: number;
      rir?: number;
      setType?: SetType;
    }
  ) => {
    if (!activeWorkout) return;

    const updatedExercises = activeWorkout.exercises.map((ex) => ({
      ...ex,
      sets: ex.sets.map((s) => (s.id === setLogId ? { ...s, ...data } : s)),
    }));
    setActiveWorkoutDirectly({ ...activeWorkout, exercises: updatedExercises }, isPastWorkout, pastWorkoutDuration);
  };

  // Restore a persisted draft (crash/refresh resume) or timer state on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
    const savedMeta = localStorage.getItem(DRAFT_META_STORAGE_KEY);
    if (savedDraft && savedMeta) {
      try {
        const workout: Workout = JSON.parse(savedDraft);
        // A draft persisted before workouts carried a localDate: derive one from the
        // instant so resuming it can still be saved. Only reachable for the first draft
        // that spans the deploy of this field.
        if (!workout.localDate) {
          workout.localDate = toLocalDateString(new Date(workout.date));
        }
        const meta: DraftMeta = JSON.parse(savedMeta);
        existingWorkoutIdRef.current = meta.existingWorkoutId;
        setIsHistoryEdit(meta.isHistoryEdit);
        setActiveWorkout(workout);
        setIsPastWorkout(meta.isPastWorkout);
        setPastWorkoutDuration(meta.pastWorkoutDuration);
      } catch {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        localStorage.removeItem(DRAFT_META_STORAGE_KEY);
      }
    }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        isHistoryEdit,
        startWorkout,
        startWorkoutFromTemplate,
        loadWorkoutForEdit,
        completeWorkout,
        discardWorkout,
        addExercise,
        removeExercise,
        replaceExercise,
        reorderExercises,
        logSet,
        deleteSet,
        updateSet,
        setActiveWorkoutDirectly,
        workoutDuration,
        restTimer,
        restTimerTarget,
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
