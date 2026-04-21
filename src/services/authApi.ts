import { baseApi } from "./api";
import type { LoginInput, RegisterInput } from "@/validations/auth.schema";

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AuthEnvelope = { user: PublicUser; accessToken: string };

export const authApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    register: b.mutation<AuthEnvelope, RegisterInput>({
      query: (body) => ({ url: "/auth/register", method: "POST", body }),
      transformResponse: (r: { data: AuthEnvelope }) => r.data,
      invalidatesTags: ["Auth"],
    }),
    login: b.mutation<AuthEnvelope, LoginInput>({
      query: (body) => ({ url: "/auth/login", method: "POST", body }),
      transformResponse: (r: { data: AuthEnvelope }) => r.data,
      invalidatesTags: ["Auth"],
    }),
    refresh: b.mutation<AuthEnvelope, void>({
      query: () => ({ url: "/auth/refresh", method: "POST" }),
      transformResponse: (r: { data: AuthEnvelope }) => r.data,
    }),
    logout: b.mutation<null, void>({
      query: () => ({ url: "/auth/logout", method: "POST" }),
      transformResponse: () => null,
      invalidatesTags: ["Auth"],
    }),
    logoutAll: b.mutation<null, void>({
      query: () => ({ url: "/auth/logout-all", method: "POST" }),
      transformResponse: () => null,
      invalidatesTags: ["Auth"],
    }),
  }),
});

export const {
  useRegisterMutation,
  useLoginMutation,
  useRefreshMutation,
  useLogoutMutation,
  useLogoutAllMutation,
} = authApi;
