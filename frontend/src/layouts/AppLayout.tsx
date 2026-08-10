import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { BarChart3, Bell, BookOpen, ClipboardList, FilePlus2, FolderCog, Gauge, LogOut, Menu, ShieldCheck, Tags, User, UserCog, Users, X } from "lucide-react";
import { appConfig } from "../config/brand";
import { roleLabels } from "../constants/labels";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../api/client";
import type { ApiResponse } from "../types";

const customerLinks = [{ to: "/dashboard", label: "Dashboard", icon: Gauge }, { to: "/tickets", label: "Meine Tickets", icon: ClipboardList }, { to: "/tickets/neu", label: "Ticket erstellen", icon: FilePlus2 }, { to: "/wissen", label: "Wissensdatenbank", icon: BookOpen }, { to: "/benachrichtigungen", label: "Benachrichtigungen", icon: Bell }, { to: "/profil", label: "Profil", icon: User }];
const agentExtra = [{ to: "/tickets", label: "Alle Tickets", icon: ClipboardList }, { to: "/tickets?unassigned=true", label: "Nicht zugewiesen", icon: ShieldCheck }];
const adminExtra = [{ to: "/verwaltung/benutzer", label: "Benutzer", icon: UserCog }, { to: "/verwaltung/teams", label: "Teams", icon: Users }, { to: "/verwaltung/kategorien", label: "Kategorien", icon: FolderCog }, { to: "/verwaltung/tags", label: "Tags", icon: Tags }, { to: "/verwaltung/sla", label: "SLA-Richtlinien", icon: ShieldCheck }, { to: "/berichte", label: "Berichte", icon: BarChart3 }, { to: "/audit", label: "Audit-Protokoll", icon: ClipboardList }];

export function AppLayout() {
  const [open, setOpen] = useState(false); const { user, logout } = useAuth(); const navigate = useNavigate();
  const notifications = useQuery({ queryKey: ["notifications"], queryFn: async () => (await api.get<ApiResponse<Array<{ readAt?: string }>>>("/notifications")).data.data, refetchInterval: 30_000 });
  if (!user) return null;
  const links = user.role === "CUSTOMER" ? customerLinks : [{ to: "/dashboard", label: "Dashboard", icon: Gauge }, ...agentExtra, { to: "/tickets/neu", label: "Ticket erstellen", icon: FilePlus2 }, { to: "/wissen", label: "Wissensdatenbank", icon: BookOpen }, { to: "/benachrichtigungen", label: "Benachrichtigungen", icon: Bell }, ...(user.role === "ADMIN" ? adminExtra : []), { to: "/profil", label: "Profil", icon: User }];
  const initials = `${user.firstName[0]}${user.lastName[0]}`;
  return <div className="app-shell">
    {open && <div className="overlay" aria-hidden="true" onClick={() => setOpen(false)} />}
    <aside className={`sidebar ${open ? "open" : ""}`} aria-label="Hauptnavigation">
      <div className="sidebar-brand"><div className="brand-icon">JI</div><div><strong>JAM IT</strong><span>Dienstleistungen</span></div></div>
      <nav className="sidebar-nav">{links.map(({ to, label, icon: Icon }) => <NavLink key={`${to}-${label}`} to={to} end={to === "/dashboard"} onClick={() => setOpen(false)} className="nav-link">{({ isActive }) => <><Icon size={19} /><span>{label}</span>{isActive && <span className="sr-only">Aktuelle Seite</span>}</>}</NavLink>)}</nav>
      <div className="sidebar-footer"><button className="nav-link" onClick={() => void logout().then(() => navigate("/anmelden"))}><LogOut size={19} />Abmelden</button></div>
    </aside>
    <div className="app-content">
      <header className="header"><div className="header-left"><button className="menu-button" aria-label={open ? "Navigation schließen" : "Navigation öffnen"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? <X /> : <Menu />}</button><div className="header-title"><strong>{appConfig.appName}</strong><span>Support- und Ticketmanagement</span></div></div><div className="header-right"><NavLink to="/benachrichtigungen" className="icon-button" aria-label={`Benachrichtigungen, ${notifications.data?.filter((item) => !item.readAt).length ?? 0} ungelesen`}><Bell size={19} />{Boolean(notifications.data?.some((item) => !item.readAt)) && <span className="notification-count">{Math.min(99, notifications.data!.filter((item) => !item.readAt).length)}</span>}</NavLink><div className="user-summary"><span className="avatar" aria-hidden="true">{initials}</span><div><strong>{user.firstName} {user.lastName}</strong><span>{roleLabels[user.role]}</span></div></div></div></header>
      <main className="main"><Outlet /></main><footer className="footer">© {new Date().getFullYear()} {appConfig.companyName}</footer>
    </div>
  </div>;
}
