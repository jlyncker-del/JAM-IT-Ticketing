import axios from "axios";
import { appConfig } from "../config/brand";

export const api = axios.create({ baseURL: appConfig.apiUrl, timeout: 15_000, headers: { "Content-Type": "application/json" } });
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("jam-it-token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use((response) => response, (error: unknown) => {
  if (axios.isAxiosError(error) && error.response?.status === 401 && !String(error.config?.url).includes("/auth/login")) {
    sessionStorage.removeItem("jam-it-token");
    window.dispatchEvent(new Event("jam-it-session-ended"));
  }
  return Promise.reject(error);
});

export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) return error.response?.data?.message ?? "Der Server ist derzeit nicht erreichbar.";
  return "Ein unerwarteter Fehler ist aufgetreten.";
}
