import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../utils/api';

interface User {
  id: string;
  username: string;
  fullName: string;
  unionId: string;
  role: string;
  department: string;
  avatar?: string;
  status: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
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
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Error loading auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      const response = await api.post('/api/auth/login', {
        username,
        password
      });

      const { token: newToken, user: newUser } = response.data;

      await AsyncStorage.setItem('token', newToken);
      await AsyncStorage.setItem('user', JSON.stringify(newUser));

      setToken(newToken);
      setUser(newUser);
    } catch (error: any) {
      if (error.response?.data?.detail) {
        throw new Error(error.response.data.detail);
      }
      throw new Error('Đăng nhập thất bại');
    }
  };

  const logout = async () => {
    console.log('🔴 LOGOUT: Starting logout process...');
    try {
      // Step 1: Clear state immediately
      console.log('🔴 LOGOUT: Clearing state...');
      setUser(null);
      setToken(null);

      // Step 2: Clear AsyncStorage
      console.log('🔴 LOGOUT: Clearing AsyncStorage...');
      await AsyncStorage.clear();

      console.log('🔴 LOGOUT: Logout completed successfully');
    } catch (error) {
      console.error('🔴 LOGOUT ERROR:', error);
      // Force clear state even on error
      setUser(null);
      setToken(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
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