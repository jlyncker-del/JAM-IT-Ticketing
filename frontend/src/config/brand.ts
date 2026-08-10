export const brandColors = {
  green: "#123D34",
  cream: "#F8F4E9",
  gold: "#D4A74E",
  white: "#FFFFFF",
  border: "#EAD39D",
  secondary: "#64736D",
  muted: "#7A8580",
  success: "#287A5B",
  warning: "#B7791F",
  error: "#B42318",
  info: "#2F6B78",
} as const;

export const appConfig = {
  appName: import.meta.env.VITE_APP_NAME ?? "JAM IT HelpDesk",
  companyName: import.meta.env.VITE_COMPANY_NAME ?? "JAM IT Dienstleistungen",
  apiUrl: import.meta.env.VITE_API_URL ?? "http://localhost:5000/api/v1",
} as const;
