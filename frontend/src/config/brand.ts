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

export function normalizeApiUrl(value: string | undefined, production = import.meta.env.PROD): string {
  const configured = value?.trim();
  if (!configured) {
    if (production) throw new Error("VITE_API_URL muss für den Produktionsbuild gesetzt sein.");
    return "http://localhost:5000/api/v1";
  }

  const url = new URL(configured);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("VITE_API_URL muss eine HTTP- oder HTTPS-Adresse sein.");
  }

  url.search = "";
  url.hash = "";
  const path = url.pathname.replace(/\/+$/, "");
  url.pathname = path === "" || path === "/" || path === "/api" ? "/api/v1" : path;
  return url.toString().replace(/\/$/, "");
}

export const appConfig = {
  appName: import.meta.env.VITE_APP_NAME ?? "JAM IT HelpDesk",
  companyName: import.meta.env.VITE_COMPANY_NAME ?? "JAM IT Dienstleistungen",
  apiUrl: normalizeApiUrl(import.meta.env.VITE_API_URL),
} as const;
