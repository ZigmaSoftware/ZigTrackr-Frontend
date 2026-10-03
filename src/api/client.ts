import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import type { ApiEnvelope } from "@/types";

/* ---- API CLIENT ----
   Authentication is an HttpOnly cookie (spec 46), so:
     - withCredentials must be on, or the browser never sends it;
     - no token is ever read or stored by JavaScript -- that is the whole point;
     - because cookies ride along automatically, every unsafe request must
       carry the CSRF header the backend enforces.
*/

const API_ROOT = import.meta.env.VITE_API_ROOT || "/api/v1";

export const api: AxiosInstance = axios.create({
  baseURL: API_ROOT,
  timeout: 30_000,
  withCredentials: true,
  headers: { Accept: "application/json" },
  xsrfCookieName: "csrftoken",
  xsrfHeaderName: "X-CSRFToken",
});

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[2]) : null;
}

const UNSAFE_METHODS = new Set(["post", "put", "patch", "delete"]);

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const method = (config.method ?? "get").toLowerCase();
  if (UNSAFE_METHODS.has(method)) {
    const token = readCookie("csrftoken");
    if (token) config.headers.set("X-CSRFToken", token);
  }
  if (config.data && !(config.data instanceof FormData)) {
    config.headers.set("Content-Type", "application/json");
  }
  return config;
});

/* ---- 401 REFRESH, SINGLE FLIGHT ----
   A dashboard fires several requests at once. If the access cookie has just
   expired they would all 401 together; without this gate each would trigger
   its own refresh, and rotation means every refresh after the first fails and
   logs the user out mid-session. */
let refreshInFlight: Promise<void> | null = null;
let onSessionLost: (() => void) | null = null;

export function setSessionLostHandler(handler: () => void) {
  onSessionLost = handler;
}

async function refreshSession(): Promise<void> {
  await api.post("/auth/refresh/");
}

// The public lookup has no session to refresh or lose: a visitor on /track is
// anonymous by design, and bouncing them to the login screen would be wrong.
const NO_RETRY_PATHS = [
  "/auth/login/", "/auth/refresh/", "/auth/logout/", "/tickets/public/",
];

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const status = error.response?.status;
    const url = config?.url ?? "";

    const retryable =
      status === 401 &&
      config &&
      !config._retried &&
      !NO_RETRY_PATHS.some((path) => url.includes(path));

    if (retryable) {
      config._retried = true;
      try {
        refreshInFlight ??= refreshSession().finally(() => {
          refreshInFlight = null;
        });
        await refreshInFlight;
        return api.request(config);
      } catch {
        onSessionLost?.();
        return Promise.reject(error);
      }
    }

    if (status === 401 && !NO_RETRY_PATHS.some((p) => url.includes(p))) {
      onSessionLost?.();
    }
    return Promise.reject(error);
  },
);

/* ---- ENVELOPE HELPERS ----
   Every response is {success, message, data} (spec 43). Unwrapping here means
   no component ever touches the envelope. */

export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const response = await api.get<ApiEnvelope<T>>(url, { params });
  return response.data.data;
}

export async function post<T>(url: string, data?: unknown): Promise<T> {
  const response = await api.post<ApiEnvelope<T>>(url, data);
  return response.data.data;
}

export async function patch<T>(url: string, data?: unknown): Promise<T> {
  const response = await api.patch<ApiEnvelope<T>>(url, data);
  return response.data.data;
}

export async function put<T>(url: string, data?: unknown): Promise<T> {
  const response = await api.put<ApiEnvelope<T>>(url, data);
  return response.data.data;
}

export async function del<T>(url: string): Promise<T> {
  const response = await api.delete<ApiEnvelope<T>>(url);
  return response.data.data;
}

/** Message from an error envelope, safe for display (spec 55: never a stack trace). */
export function apiErrorMessage(error: unknown, fallback = "Something went wrong. Please retry."): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined;
    if (data?.message) return data.message;
    if (error.code === "ECONNABORTED") return "The request timed out. Please retry.";
    if (!error.response) return "Unable to reach the server. Check your connection.";
  }
  return fallback;
}

/** Field errors for react-hook-form's setError. */
export function apiFieldErrors(error: unknown): Record<string, string> {
  if (!axios.isAxiosError(error)) return {};
  const errors = (error.response?.data as { errors?: Record<string, string[] | string> })?.errors;
  if (!errors) return {};
  const out: Record<string, string> = {};
  for (const [field, value] of Object.entries(errors)) {
    out[field] = Array.isArray(value) ? value[0] : String(value);
  }
  return out;
}

export async function bootstrapCsrf(): Promise<void> {
  try {
    await api.get("/auth/csrf/");
  } catch {
    // Non-fatal: login will still work if the cookie arrives with the response.
  }
}
