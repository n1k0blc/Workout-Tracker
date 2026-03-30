'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, LoginCredentials, RegisterCredentials } from '@/types';
import { apiClient } from '@/lib/api/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('access_token')
          : null;

      if (token) {
        try {
          const profile = await apiClient.getProfile();
          setUser(profile);
        } catch (error) {
          console.error('Failed to load user profile:', error);
          localStorage.removeItem('access_token');
        }
      }

      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    const response = await apiClient.login(credentials);
    setUser(response.user);
  };

  const register = async (credentials: RegisterCredentials) => {
    const response = await apiClient.register(credentials);
    setUser(response.user);
  };

  const logout = () => {
    apiClient.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
