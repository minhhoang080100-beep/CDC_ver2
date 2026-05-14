import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setTokenExpiredCallback, setAuthToken } from '../utils/api';

interface User {
  id: string;
  username: string;
  fullName: string;
  unionId: string;
  role: string;
  department: string;
  avatar?: string;
  cccdNumber?: string;
  status: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      const storedUser = await AsyncStorage.getItem('user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setAuthToken(storedToken);
        setUser(JSON.parse(storedUser));

        // Validate token with server to detect disabled accounts
        try {
          const response = await api.get('/api/auth/me');
          if (response.data) {
            setUser(response.data);
            await AsyncStorage.setItem('user', JSON.stringify(response.data));
          }
        } catch (error: any) {
          // Token invalid or account disabled — auto logout
          console.warn('Stored token invalid, clearing session');
          await clearAuthData();
        }
      }
    } catch (error) {
      console.error('Error loading auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearAuthData = async () => {
    setUser(null);
    setToken(null);
    setAuthToken(null);
    await AsyncStorage.multiRemove(['token', 'refreshToken', 'user']);
  };

  const login = async (username: string, password: string) => {
    try {
      const response = await api.post('/api/auth/login', {
        username,
        password
      });

      const { token: newToken, refreshToken, user: newUser } = response.data;

      await AsyncStorage.setItem('token', newToken);
      if (refreshToken) {
        await AsyncStorage.setItem('refreshToken', refreshToken);
      }
      await AsyncStorage.setItem('user', JSON.stringify(newUser));

      setToken(newToken);
      setAuthToken(newToken);
      setUser(newUser);
    } catch (error: any) {
      if (error.response?.data?.detail) {
        throw new Error(error.response.data.detail);
      }
      throw new Error(error.detail || error.message || 'Đăng nhập thất bại');
    }
  };

  const refreshUser = async () => {
    const response = await api.get('/api/auth/me');
    if (response.data) {
      setUser(response.data);
      await AsyncStorage.setItem('user', JSON.stringify(response.data));
    }
  };

  const logout = async () => {
    console.log('🔴 LOGOUT: Starting logout process...');
    try {
      // Revoke refresh tokens on server (best-effort)
      await api.post('/api/auth/logout').catch(() => { });
      await clearAuthData();
      console.log('🔴 LOGOUT: Logout completed successfully');
    } catch (error) {
      console.error('🔴 LOGOUT ERROR:', error);
      setUser(null);
      setToken(null);
      setAuthToken(null);
    }
  };

  // Register token expiry callback
  useEffect(() => {
    setTokenExpiredCallback(() => {
      console.log('🔴 Token expired - auto logout');
      logout();
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
