import {
  AuthResponse,
  LoginCredentials,
  RegisterCredentials,
  User,
  Exercise,
  UpdateExerciseDto,
  Workout,
  WorkoutListItem,
  WorkoutCycle,
  CycleDetails,
  VolumeAnalytics,
  PersonalRecord,
  PersonalRecordsResponse,
  ORMAnalytics,
  CycleList,
  ORMByCycleAnalytics,
  RIRByCycleAnalytics,
  RIRAnalytics,
  DurationAnalytics,
  DurationByCycleAnalytics,
  RestTimeAnalytics,
  RestTimeByCycleAnalytics,
  RepsAnalytics,
  RepsByCycleAnalytics,
  SetsAnalytics,
  SetsByCycleAnalytics,
  MuscleGroup,
  Equipment,
  HomeGym,
  WorkoutTemplate,
  CreateWorkoutTemplate,
  UpdateWorkoutTemplate,
  DashboardStats,
  NextPlannedWorkout,
  CycleProgress,
  SetType,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getCsrfToken(): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  // Cookie-based auth session refresh. Raw fetch (not this.request) so it can't
  // recursively trigger its own refresh/redirect handling.
  private async tryRefresh(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    opts: { isRetry?: boolean; suppressRedirect?: boolean } = {}
  ): Promise<T> {
    const method = (options.method || 'GET').toUpperCase();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (options.headers) {
      Object.assign(headers, options.headers);
    }

    // Double-submit CSRF cookie: echo it back as a header on every mutating request.
    if (method !== 'GET' && method !== 'HEAD') {
      const csrfToken = this.getCsrfToken();
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (response.status === 401) {
      // /auth/* 401s are real auth failures (bad credentials, expired session on
      // refresh itself) - never retry-refresh or redirect for those, let the
      // caller (login form, change-password form, ...) handle the error.
      const isAuthEndpoint = endpoint.startsWith('/auth/');

      if (!opts.isRetry && !isAuthEndpoint) {
        const refreshed = await this.tryRefresh();
        if (refreshed) {
          return this.request<T>(endpoint, options, { ...opts, isRetry: true });
        }
      }

      if (!opts.suppressRedirect && !isAuthEndpoint && typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    // Handle empty responses (e.g., 204 No Content or null responses)
    const text = await response.text();
    if (!text || text.trim() === '') {
      return null as T;
    }

    try {
      return JSON.parse(text);
    } catch (e) {
      console.error('Failed to parse response:', text);
      throw new Error('Invalid JSON response');
    }
  }

  // Helper function to add query parameters (supports arrays)
  private addQueryParam(query: URLSearchParams, key: string, value: string | string[] | undefined): void {
    if (!value) return;
    
    if (Array.isArray(value)) {
      value.forEach(v => query.append(key, v));
    } else {
      query.append(key, value);
    }
  }

  // Auth Methods
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async logout(): Promise<void> {
    try {
      await this.request<void>('/auth/logout', { method: 'POST' });
    } catch {
      // Logout is best-effort client-side too - cookies may already be gone/expired.
    }
  }

  async changePassword(data: { currentPassword: string; newPassword: string }): Promise<void> {
    await this.request<void>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getProfile(): Promise<User> {
    return this.request<User>('/users/me');
  }

  // Silent session check for app bootstrap: never redirects to /login on a
  // fresh/anonymous visit, just resolves to null.
  async checkAuth(): Promise<User | null> {
    try {
      return await this.request<User>('/users/me', {}, { suppressRedirect: true });
    } catch {
      return null;
    }
  }

  async updateProfile(data: {
    email?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    height?: number;
    weight?: number;
  }): Promise<User> {
    return this.request<User>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // HomeGym Methods
  async getHomeGyms(): Promise<HomeGym[]> {
    return this.request<HomeGym[]>('/users/me/home-gyms');
  }

  async createHomeGym(data: { name: string }): Promise<HomeGym> {
    return this.request<HomeGym>('/users/me/home-gyms', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateHomeGym(id: string, data: { name: string }): Promise<HomeGym> {
    return this.request<HomeGym>(`/users/me/home-gyms/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteHomeGym(id: string): Promise<void> {
    await this.request(`/users/me/home-gyms/${id}`, {
      method: 'DELETE',
    });
  }

  // Exercise Methods
  async getExercises(params?: {
    search?: string;
    muscleGroup?: MuscleGroup;
    equipment?: Equipment;
    includeCustom?: boolean;
  }): Promise<Exercise[]> {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.muscleGroup) query.append('muscleGroup', params.muscleGroup);
    if (params?.equipment) query.append('equipment', params.equipment);
    if (params?.includeCustom !== undefined)
      query.append('includeCustom', String(params.includeCustom));

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return this.request<Exercise[]>(`/exercises${queryString}`);
  }

  async getExercise(id: string): Promise<Exercise> {
    return this.request<Exercise>(`/exercises/${id}`);
  }

  async createExercise(data: {
    name: string;
    muscleGroup: MuscleGroup;
    equipment: Equipment;
    isUnilateral?: boolean;
    isDoubleWeight?: boolean;
  }): Promise<Exercise> {
    return this.request<Exercise>('/exercises', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteExercise(id: string): Promise<void> {
    await this.request(`/exercises/${id}`, {
      method: 'DELETE',
    });
  }

  async updateExercise(id: string, data: UpdateExerciseDto): Promise<Exercise> {
    return this.request<Exercise>(`/exercises/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Workout Methods
  async getSuggestedWorkout(): Promise<Workout> {
    return this.request<Workout>('/workouts/suggested');
  }

  async getCurrentCycleWorkouts(): Promise<{
    cycleId: string;
    cycleName: string;
    workoutDays: Array<{
      workoutDayId: string;
      workoutDayName: string;
      weekday: number;
      isSuggested: boolean;
      exerciseCount: number;
    }>;
  } | null> {
    return this.request('/workouts/cycle/workouts');
  }

  async getActiveWorkout(): Promise<Workout | null> {
    return this.request<Workout>('/workouts/active');
  }

  async getWorkout(id: string): Promise<Workout> {
    return this.request<Workout>(`/workouts/${id}`);
  }

  async startWorkout(data: {
    cycleId?: string;
    workoutDayId?: string;
    isFreeWorkout: boolean;
    homeGymId: string | null;
    isPastWorkout?: boolean;
    pastWorkoutDate?: string;
    pastWorkoutDuration?: number;
  }): Promise<Workout> {
    return this.request<Workout>('/workouts/start', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async startWorkoutFromTemplate(
    templateId: string,
    homeGymId?: string,
    isPastWorkout?: boolean,
    pastWorkoutDate?: string,
    pastWorkoutDuration?: number,
  ): Promise<Workout> {
    return this.request<Workout>(`/workouts/start-from-template/${templateId}`, {
      method: 'POST',
      body: JSON.stringify({ 
        homeGymId,
        isPastWorkout,
        pastWorkoutDate,
        pastWorkoutDuration,
      }),
    });
  }

  async addExerciseToWorkout(
    workoutId: string,
    exerciseId: string
  ): Promise<Workout> {
    return this.request<Workout>(`/workouts/${workoutId}/exercises`, {
      method: 'POST',
      body: JSON.stringify({ exerciseId }),
    });
  }

  async removeExerciseFromWorkout(
    workoutId: string,
    exerciseLogId: string
  ): Promise<Workout> {
    return this.request<Workout>(
      `/workouts/${workoutId}/exercises/${exerciseLogId}`,
      {
        method: 'DELETE',
      }
    );
  }

  async reorderExercises(
    workoutId: string,
    exerciseIds: string[]
  ): Promise<Workout> {
    return this.request<Workout>(
      `/workouts/${workoutId}/exercises/reorder`,
      {
        method: 'PATCH',
        body: JSON.stringify({ exerciseIds }),
      }
    );
  }

  async logSet(
    workoutId: string,
    exerciseLogId: string,
    data: {
      setNumber: number;
      reps: number;
      weight: number;
      rir?: number;
      setType?: string;
      actualRestDuration?: number;
    }
  ): Promise<Workout> {
    return this.request<Workout>(
      `/workouts/${workoutId}/exercises/${exerciseLogId}/sets`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  async deleteSet(
    workoutId: string,
    setLogId: string
  ): Promise<Workout> {
    return this.request<Workout>(
      `/workouts/${workoutId}/sets/${setLogId}`,
      {
        method: 'DELETE',
      }
    );
  }

  async updateSet(
    workoutId: string,
    setLogId: string,
    data: {
      reps?: number;
      weight?: number;
      rir?: number;
      setType?: SetType;
    }
  ): Promise<Workout> {
    return this.request<Workout>(
      `/workouts/${workoutId}/sets/${setLogId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    );
  }

  async replaceExercise(
    workoutId: string,
    exerciseLogId: string,
    newExerciseId: string
  ): Promise<Workout> {
    return this.request<Workout>(
      `/workouts/${workoutId}/exercises/${exerciseLogId}/replace`,
      {
        method: 'PATCH',
        body: JSON.stringify({ newExerciseId }),
      }
    );
  }

  async completeWorkout(
    workoutId: string,
    data?: {
      totalDuration?: number;
      updateBlueprint?: boolean;
    }
  ): Promise<Workout> {
    return this.request<Workout>(`/workouts/${workoutId}/complete`, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async discardWorkout(workoutId: string): Promise<void> {
    await this.request<void>(`/workouts/${workoutId}/discard`, {
      method: 'POST',
    });
  }

  async getWorkoutHistory(params?: {
    startDate?: string;
    endDate?: string;
    cycleId?: string;
    status?: string;
  }): Promise<WorkoutListItem[]> {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.cycleId) query.append('cycleId', params.cycleId);
    if (params?.status) query.append('status', params.status);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return this.request<WorkoutListItem[]>(`/workouts${queryString}`);
  }

  // Cycle Methods
  async getCycles(): Promise<WorkoutCycle[]> {
    return this.request<WorkoutCycle[]>('/cycles');
  }

  async getCycle(id: string): Promise<WorkoutCycle> {
    return this.request<WorkoutCycle>(`/cycles/${id}`);
  }

  async getCycleDetails(id: string): Promise<CycleDetails> {
    return this.request<CycleDetails>(`/cycles/${id}/details`);
  }

  async createCycle(data: {
    name: string;
    duration: number;
    startDate: string;
    workoutDays: Array<{
      weekday: number;
      name: string;
      exercises: Array<{
        exerciseId: string;
        order: number;
        sets: Array<{
          order: number;
          setType: string;
          reps: number;
          weight: number;
          rir: number;
          restAfterSet: number;
        }>;
      }>;
    }>;
  }): Promise<WorkoutCycle> {
    return this.request<WorkoutCycle>('/cycles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteCycle(id: string): Promise<void> {
    await this.request(`/cycles/${id}`, {
      method: 'DELETE',
    });
  }

  async completeCycle(id: string): Promise<WorkoutCycle> {
    return this.request<WorkoutCycle>(`/cycles/${id}/complete`, {
      method: 'POST',
    });
  }

  async updateBlueprint(
    cycleId: string,
    workoutDayId: string,
    data: {
      exercises: Array<{
        exerciseId: string;
        order: number;
        sets: Array<{
          order: number;
          setType: string;
          reps: number;
          weight: number;
          rir: number;
          restAfterSet: number;
        }>;
      }>;
    }
  ): Promise<WorkoutCycle> {
    return this.request<WorkoutCycle>(
      `/cycles/${cycleId}/workout-days/${workoutDayId}/blueprint`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    );
  }

  async updateWorkoutDay(
    cycleId: string,
    workoutDayId: string,
    data: {
      name: string;
      weekday: number;
      plannedHomeGymId?: string;
    }
  ): Promise<WorkoutCycle> {
    return this.request<WorkoutCycle>(
      `/cycles/${cycleId}/workout-days/${workoutDayId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    );
  }

  async updateCompletedWorkout(
    workoutId: string,
    data: {
      completedAt?: string;
      exercises: Array<{
        id: string;
        sets: Array<{
          id: string;
          reps: number;
          weight: number;
          rir?: number;
        }>;
      }>;
    }
  ): Promise<Workout> {
    return this.request<Workout>(`/workouts/${workoutId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Analytics Methods
  async getVolumeAnalytics(params?: {
    startDate?: string;
    endDate?: string;
    gymId?: string;
    muscleGroup?: string | string[];
    equipment?: string | string[];
    cycleId?: string;
    aggregation?: 'day' | 'week';
    exerciseId?: string;
  }): Promise<VolumeAnalytics> {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.gymId) query.append('gymId', params.gymId);
    this.addQueryParam(query, 'muscleGroup', params?.muscleGroup);
    this.addQueryParam(query, 'equipment', params?.equipment);
    if (params?.cycleId) query.append('cycleId', params.cycleId);
    if (params?.aggregation) query.append('aggregation', params.aggregation);
    if (params?.exerciseId) query.append('exerciseId', params.exerciseId);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return this.request<VolumeAnalytics>(`/analytics/volume${queryString}`);
  }

  async getPersonalRecords(params?: {
    exerciseId?: string;
    muscleGroup?: string | string[];
    equipment?: string | string[];
    gymId?: string;
  }): Promise<PersonalRecordsResponse> {
    const query = new URLSearchParams();
    if (params?.exerciseId) query.append('exerciseId', params.exerciseId);
    this.addQueryParam(query, 'muscleGroup', params?.muscleGroup);
    this.addQueryParam(query, 'equipment', params?.equipment);
    if (params?.gymId) query.append('gymId', params.gymId);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return this.request<PersonalRecordsResponse>(`/analytics/prs${queryString}`);
  }

  async getORMAnalytics(
    cycleId: string,
    workoutDayId: string,
  ): Promise<ORMAnalytics> {
    return this.request<ORMAnalytics>(
      `/analytics/orm/${cycleId}/${workoutDayId}`
    );
  }

  async getAnalyticsCycles(): Promise<CycleList> {
    return this.request<CycleList>('/analytics/cycles');
  }

  async getORMByCycle(
    cycleId: string,
    muscleGroup?: string | string[],
    equipment?: string | string[],
    aggregation?: 'day' | 'week',
    exerciseId?: string,
  ): Promise<ORMByCycleAnalytics> {
    const query = new URLSearchParams();
    this.addQueryParam(query, 'muscleGroup', muscleGroup);
    this.addQueryParam(query, 'equipment', equipment);
    if (aggregation) query.append('aggregation', aggregation);
    if (exerciseId) query.append('exerciseId', exerciseId);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return this.request<ORMByCycleAnalytics>(
      `/analytics/orm-by-cycle/${cycleId}${queryString}`
    );
  }

  async getRIRByCycle(
    cycleId: string,
    gymId?: string,
    muscleGroup?: string | string[],
    equipment?: string | string[],
    timeOfDay?: string,
    aggregation?: 'day' | 'week',
    exerciseId?: string,
  ): Promise<RIRByCycleAnalytics> {
    const query = new URLSearchParams();
    if (gymId) query.append('gymId', gymId);
    this.addQueryParam(query, 'muscleGroup', muscleGroup);
    this.addQueryParam(query, 'equipment', equipment);
    if (timeOfDay) query.append('timeOfDay', timeOfDay);
    if (aggregation) query.append('aggregation', aggregation);
    if (exerciseId) query.append('exerciseId', exerciseId);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return this.request<RIRByCycleAnalytics>(
      `/analytics/rir-by-cycle/${cycleId}${queryString}`
    );
  }

  async getRIRAnalytics(params: {
    period?: 'week' | 'month' | 'all';
    startDate?: string;
    endDate?: string;
    gymId?: string;
    muscleGroup?: string | string[];
    equipment?: string | string[];
    aggregation?: 'day' | 'week';
    exerciseId?: string;
  }): Promise<RIRAnalytics> {
    const query = new URLSearchParams();
    if (params.period) query.append('period', params.period);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    if (params.gymId) query.append('gymId', params.gymId);
    this.addQueryParam(query, 'muscleGroup', params.muscleGroup);
    this.addQueryParam(query, 'equipment', params.equipment);
    if (params.aggregation) query.append('aggregation', params.aggregation);
    if (params.exerciseId) query.append('exerciseId', params.exerciseId);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return this.request<RIRAnalytics>(`/analytics/rir${queryString}`);
  }

  async getDurationAnalytics(params: {
    period?: 'week' | 'month' | 'all';
    startDate?: string;
    endDate?: string;
    gymId?: string;
    muscleGroup?: string | string[];
    equipment?: string | string[];
    aggregation?: 'day' | 'week';
  }): Promise<DurationAnalytics> {
    const query = new URLSearchParams();
    if (params.period) query.append('period', params.period);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    if (params.gymId) query.append('gymId', params.gymId);
    this.addQueryParam(query, 'muscleGroup', params.muscleGroup);
    this.addQueryParam(query, 'equipment', params.equipment);
    if (params.aggregation) query.append('aggregation', params.aggregation);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return this.request<DurationAnalytics>(`/analytics/duration${queryString}`);
  }

  async getDurationByCycle(
    cycleId: string,
    gymId?: string,
    muscleGroup?: string | string[],
    equipment?: string | string[],
    aggregation?: 'day' | 'week',
  ): Promise<DurationByCycleAnalytics> {
    const query = new URLSearchParams();
    if (gymId) query.append('gymId', gymId);
    this.addQueryParam(query, 'muscleGroup', muscleGroup);
    this.addQueryParam(query, 'equipment', equipment);
    if (aggregation) query.append('aggregation', aggregation);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return this.request<DurationByCycleAnalytics>(
      `/analytics/duration-by-cycle/${cycleId}${queryString}`
    );
  }

  async getRestTimeAnalytics(params: {
    period?: 'week' | 'month' | 'all';
    startDate?: string;
    endDate?: string;
    gymId?: string;
    muscleGroup?: string | string[];
    equipment?: string | string[];
    aggregation?: 'day' | 'week';
    exerciseId?: string;
  }): Promise<RestTimeAnalytics> {
    const query = new URLSearchParams();
    if (params.period) query.append('period', params.period);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    if (params.gymId) query.append('gymId', params.gymId);
    this.addQueryParam(query, 'muscleGroup', params.muscleGroup);
    this.addQueryParam(query, 'equipment', params.equipment);
    if (params.aggregation) query.append('aggregation', params.aggregation);
    if (params.exerciseId) query.append('exerciseId', params.exerciseId);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return this.request<RestTimeAnalytics>(`/analytics/rest-time${queryString}`);
  }

  async getRestTimeByCycle(
    cycleId: string,
    gymId?: string,
    muscleGroup?: string | string[],
    equipment?: string | string[],
    aggregation?: 'day' | 'week',
    exerciseId?: string,
  ): Promise<RestTimeByCycleAnalytics> {
    const query = new URLSearchParams();
    if (gymId) query.append('gymId', gymId);
    this.addQueryParam(query, 'muscleGroup', muscleGroup);
    this.addQueryParam(query, 'equipment', equipment);
    if (aggregation) query.append('aggregation', aggregation);
    if (exerciseId) query.append('exerciseId', exerciseId);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return this.request<RestTimeByCycleAnalytics>(
      `/analytics/rest-time-by-cycle/${cycleId}${queryString}`
    );
  }

  async getRepsAnalytics(params: {
    period?: 'week' | 'month' | 'all';
    startDate?: string;
    endDate?: string;
    gymId?: string;
    muscleGroup?: string | string[];
    equipment?: string | string[];
    aggregation?: 'day' | 'week';
    exerciseId?: string;
  }): Promise<RepsAnalytics> {
    const query = new URLSearchParams();
    if (params.period) query.append('period', params.period);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    if (params.gymId) query.append('gymId', params.gymId);
    this.addQueryParam(query, 'muscleGroup', params.muscleGroup);
    this.addQueryParam(query, 'equipment', params.equipment);
    if (params.aggregation) query.append('aggregation', params.aggregation);
    if (params.exerciseId) query.append('exerciseId', params.exerciseId);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return this.request<RepsAnalytics>(`/analytics/reps${queryString}`);
  }

  async getRepsByCycle(
    cycleId: string,
    muscleGroup?: string | string[],
    equipment?: string | string[],
    aggregation?: 'day' | 'week',
    exerciseId?: string,
  ): Promise<RepsByCycleAnalytics> {
    const query = new URLSearchParams();
    this.addQueryParam(query, 'muscleGroup', muscleGroup);
    this.addQueryParam(query, 'equipment', equipment);
    if (aggregation) query.append('aggregation', aggregation);
    if (exerciseId) query.append('exerciseId', exerciseId);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return this.request<RepsByCycleAnalytics>(
      `/analytics/reps-by-cycle/${cycleId}${queryString}`
    );
  }

  async getSetsAnalytics(params: {
    period?: 'week' | 'month' | 'all';
    startDate?: string;
    endDate?: string;
    gymId?: string;
    muscleGroup?: string | string[];
    equipment?: string | string[];
    aggregation?: 'day' | 'week';
    exerciseId?: string;
  }): Promise<SetsAnalytics> {
    const query = new URLSearchParams();
    if (params.period) query.append('period', params.period);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    if (params.gymId) query.append('gymId', params.gymId);
    this.addQueryParam(query, 'muscleGroup', params.muscleGroup);
    this.addQueryParam(query, 'equipment', params.equipment);
    if (params.aggregation) query.append('aggregation', params.aggregation);
    if (params.exerciseId) query.append('exerciseId', params.exerciseId);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return this.request<SetsAnalytics>(`/analytics/sets${queryString}`);
  }

  async getSetsByCycle(
    cycleId: string,
    muscleGroup?: string | string[],
    equipment?: string | string[],
    aggregation?: 'day' | 'week',
    exerciseId?: string,
  ): Promise<SetsByCycleAnalytics> {
    const query = new URLSearchParams();
    this.addQueryParam(query, 'muscleGroup', muscleGroup);
    this.addQueryParam(query, 'equipment', equipment);
    if (aggregation) query.append('aggregation', aggregation);
    if (exerciseId) query.append('exerciseId', exerciseId);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return this.request<SetsByCycleAnalytics>(
      `/analytics/sets-by-cycle/${cycleId}${queryString}`
    );
  }

  // Dashboard Methods
  async getCurrentWeekStats(): Promise<DashboardStats> {
    return this.request<DashboardStats>('/dashboard/stats/current-week');
  }

  async getNextPlannedWorkout(): Promise<NextPlannedWorkout | null> {
    return this.request<NextPlannedWorkout | null>('/dashboard/next-planned-workout');
  }

  async getCycleProgress(): Promise<CycleProgress | null> {
    return this.request<CycleProgress | null>('/dashboard/cycle-progress');
  }

  // Workout Template Methods
  async getWorkoutTemplates(): Promise<WorkoutTemplate[]> {
    return this.request<WorkoutTemplate[]>('/workout-templates');
  }

  async getWorkoutTemplate(id: string): Promise<WorkoutTemplate> {
    return this.request<WorkoutTemplate>(`/workout-templates/${id}`);
  }

  async createWorkoutTemplate(data: CreateWorkoutTemplate): Promise<WorkoutTemplate> {
    return this.request<WorkoutTemplate>('/workout-templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWorkoutTemplate(id: string, data: UpdateWorkoutTemplate): Promise<WorkoutTemplate> {
    return this.request<WorkoutTemplate>(`/workout-templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteWorkoutTemplate(id: string): Promise<void> {
    await this.request(`/workout-templates/${id}`, {
      method: 'DELETE',
    });
  }

  async createWorkoutTemplateFromBlueprint(blueprintId: string, name: string): Promise<WorkoutTemplate> {
    return this.request<WorkoutTemplate>(`/workout-templates/from-blueprint/${blueprintId}`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async createWorkoutTemplateFromWorkout(workoutId: string, name: string): Promise<WorkoutTemplate> {
    return this.request<WorkoutTemplate>(`/workout-templates/from-workout/${workoutId}`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }
}

export const apiClient = new ApiClient(API_URL);
