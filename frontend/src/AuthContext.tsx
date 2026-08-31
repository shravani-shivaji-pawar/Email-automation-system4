import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { User } from './types';
import { login as apiLogin, getConsentStatus } from './api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  logout: () => void;
  acceptTerms: () => void;
  updateUser: (data: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const storedLocal = localStorage.getItem('user');
    if (storedLocal) return JSON.parse(storedLocal);
    const storedSession = sessionStorage.getItem('user');
    if (storedSession) return JSON.parse(storedSession);
    return null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      getConsentStatus()
        .then((res) => {
          const updated = {
            ...user,
            has_accepted_terms: res.data.has_accepted,
          };
          setUser(updated);
          if (localStorage.getItem('user') || localStorage.getItem('remember_me') === 'true') {
            localStorage.setItem('user', JSON.stringify(updated));
          } else {
            sessionStorage.setItem('user', JSON.stringify(updated));
          }
        })
        .catch((err) => {
          console.error('Failed to sync consent status on mount:', err);
        });
    }
  }, []);

  const login = useCallback(async (email: string, password: string, rememberMe: boolean) => {
    setLoading(true);
    try {
      const res = await apiLogin({ email, password });
      
      // Resolve consent status right after login success
      let hasAcceptedTerms = false;
      try {
        const consentRes = await getConsentStatus();
        hasAcceptedTerms = consentRes.data.has_accepted;
      } catch (err) {
        console.error('Failed to fetch consent status on login:', err);
      }

      const userData: User = {
        id: res.data.user_id,
        name: res.data.name,
        email: res.data.email,
        phone: res.data.phone || '',
        role: res.data.role,
        has_accepted_terms: hasAcceptedTerms,
      };
      setUser(userData);
      if (rememberMe) {
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('remember_me', 'true');
        sessionStorage.removeItem('user');
      } else {
        sessionStorage.setItem('user', JSON.stringify(userData));
        localStorage.removeItem('user');
        localStorage.removeItem('remember_me');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('remember_me');
    sessionStorage.removeItem('user');
  }, []);

  const acceptTerms = useCallback(() => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, has_accepted_terms: true };
      if (localStorage.getItem('user') || localStorage.getItem('remember_me') === 'true') {
        localStorage.setItem('user', JSON.stringify(updated));
      } else {
        sessionStorage.setItem('user', JSON.stringify(updated));
      }
      return updated;
    });
  }, []);

  const updateUser = useCallback((data: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...data };
      if (localStorage.getItem('user') || localStorage.getItem('remember_me') === 'true') {
        localStorage.setItem('user', JSON.stringify(updated));
      } else {
        sessionStorage.setItem('user', JSON.stringify(updated));
      }
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, acceptTerms, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};