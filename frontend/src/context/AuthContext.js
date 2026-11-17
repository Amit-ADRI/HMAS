'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('hmas_token');
    const userData = localStorage.getItem('hmas_user');
    if (token && userData) {
      try {
        setUser(JSON.parse(userData));
      } catch {}
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const data = await api.post('/v1/auth/login', { email, password });
    localStorage.setItem('hmas_token', data.accessToken);
    localStorage.setItem('hmas_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try { await api.post('/v1/auth/logout', {}); } catch {}
    localStorage.removeItem('hmas_token');
    localStorage.removeItem('hmas_user');
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
