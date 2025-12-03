import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: number;
  username: string;
  phone?: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (login: string, password: string) => Promise<void>; // loginは電話番号またはメールアドレス
  register: (username: string, password: string, phone?: string, email?: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // ローカルストレージからトークンとユーザー情報を読み込む
    const savedToken = localStorage.getItem('nouka_map_token');
    const savedUser = localStorage.getItem('nouka_map_user');
    
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (login: string, password: string) => {
    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }), // loginは電話番号またはメールアドレス
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'ログインに失敗しました');
      }

      const data = await res.json();
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('nouka_map_token', data.token);
      localStorage.setItem('nouka_map_user', JSON.stringify(data.user));
    } catch (error: any) {
      throw error;
    }
  };

  const register = async (username: string, password: string, phone?: string, email?: string) => {
    try {
      const res = await fetch(`${API_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, phone, email }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || '登録に失敗しました');
      }

      const data = await res.json();
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('nouka_map_token', data.token);
      localStorage.setItem('nouka_map_user', JSON.stringify(data.user));
    } catch (error: any) {
      throw error;
    }
  };

  const logout = () => {
    // ログアウト前にユーザーIDを保存（自宅設定は保持するため削除しない）
    const currentUser = user;
    setToken(null);
    setUser(null);
    localStorage.removeItem('nouka_map_token');
    localStorage.removeItem('nouka_map_user');
    // 自宅設定と作業者名は保持する（削除しない）
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, isLoading }}>
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

