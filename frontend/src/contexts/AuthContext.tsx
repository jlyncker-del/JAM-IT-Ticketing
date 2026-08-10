import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api/client";
import type { ApiResponse, User } from "../types";

interface AuthContextValue { user: User | null; loading: boolean; login: (email: string, password: string) => Promise<User>; logout: () => Promise<void>; refresh: () => Promise<void> }
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!sessionStorage.getItem("jam-it-token")) { setUser(null); setLoading(false); return; }
    try { const { data } = await api.get<ApiResponse<User>>("/auth/me"); setUser(data.data); }
    catch { sessionStorage.removeItem("jam-it-token"); setUser(null); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); const end = () => setUser(null); window.addEventListener("jam-it-session-ended", end); return () => window.removeEventListener("jam-it-session-ended", end); }, [refresh]);
  const login = async (email: string, password: string) => { const { data } = await api.post<ApiResponse<{ token: string; user: User }>>("/auth/login", { email, password }); sessionStorage.setItem("jam-it-token", data.data.token); setUser(data.data.user); return data.data.user; };
  const logout = async () => { try { await api.post("/auth/logout"); } finally { sessionStorage.removeItem("jam-it-token"); setUser(null); } };
  const value = useMemo(() => ({ user, loading, login, logout, refresh }), [user, loading, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error("AuthProvider fehlt"); return value; }
