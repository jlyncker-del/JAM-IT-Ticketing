import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import type { UserRole } from "../types";
import { LoadingState } from "../components/ui";

export function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: UserRole[] }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState label="Sitzung wird geprüft …" />;
  if (!user) return <Navigate to="/anmelden" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/nicht-berechtigt" replace />;
  return children;
}
