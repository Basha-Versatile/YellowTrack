import {
  BaseQueryFn,
  createApi,
  fetchBaseQuery,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { getAccessToken, setAccessToken } from "@/lib/api";

/**
 * RTK Query base API.
 *
 * IMPORTANT: This runs ALONGSIDE the existing axios client during migration.
 * It targets same-origin `/api/*` (Next.js route handlers). The axios client
 * still targets `NEXT_PUBLIC_API_URL` (legacy Express) until Wave 7 cutover.
 *
 * Both use the same localStorage-backed access token so auth state is shared.
 */

const rawBaseQuery = fetchBaseQuery({
  baseUrl: "/api",
  credentials: "include", // send refreshToken cookie to /api/auth/refresh
  prepareHeaders: (headers) => {
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return headers;
  },
});

let refreshPromise: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return false;
      const body = await res.json();
      const newToken = body?.data?.accessToken;
      if (!newToken) return false;
      setAccessToken(newToken);
      if (body?.data?.user && typeof window !== "undefined") {
        localStorage.setItem("user", JSON.stringify(body.data.user));
      }
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  const url = typeof args === "string" ? args : args.url;
  const isAuthRoute =
    url.includes("/auth/login") ||
    url.includes("/auth/register") ||
    url.includes("/auth/refresh");

  if (result.error?.status === 401 && !isAuthRoute) {
    const ok = await attemptRefresh();
    if (ok) {
      result = await rawBaseQuery(args, api, extraOptions);
    } else {
      if (typeof window !== "undefined") {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("user");
      }
    }
  }

  return result;
};

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    "Auth",
    "Vehicle",
    "VehicleGroup",
    "DocumentType",
    "Driver",
    "DriverDocument",
    "Compliance",
    "Challan",
    "Payment",
    "Fastag",
    "FastagTransaction",
    "Insurance",
    "Notification",
    "Service",
    "Expense",
    "Tyre",
  ],
  endpoints: () => ({}),
});
