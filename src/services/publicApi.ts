import { baseApi } from "./api";
import type { PublicDriverUpdateInput } from "@/validations/publicDriver.schema";

export const publicApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getVehiclePublic: b.query<unknown, string>({
      query: (id) => `/public/vehicles/${id}`,
      transformResponse: (r: { data: unknown }) => r.data,
    }),
    getDriverVerification: b.query<unknown, string>({
      query: (token) => `/public/driver/verify/${token}`,
      transformResponse: (r: { data: unknown }) => r.data,
    }),
    updateDriverVerification: b.mutation<
      unknown,
      { token: string; data: PublicDriverUpdateInput }
    >({
      query: ({ token, data }) => ({
        url: `/public/driver/verify/${token}`,
        method: "PUT",
        body: data,
      }),
      transformResponse: (r: { data: unknown }) => r.data,
    }),
    uploadDriverVerifyPhoto: b.mutation<
      unknown,
      { token: string; file: File }
    >({
      query: ({ token, file }) => {
        const fd = new FormData();
        fd.append("photo", file);
        return {
          url: `/public/driver/verify/${token}/photo`,
          method: "POST",
          body: fd,
        };
      },
      transformResponse: (r: { data: unknown }) => r.data,
    }),
    uploadAddressVerifyPhoto: b.mutation<
      unknown,
      { token: string; type: "current" | "permanent"; file: File }
    >({
      query: ({ token, type, file }) => {
        const fd = new FormData();
        fd.append("photo", file);
        return {
          url: `/public/driver/verify/${token}/address-photo/${type}`,
          method: "POST",
          body: fd,
        };
      },
      transformResponse: (r: { data: unknown }) => r.data,
    }),
    deleteAddressVerifyPhoto: b.mutation<
      unknown,
      { token: string; type: "current" | "permanent"; url: string }
    >({
      query: ({ token, type, url }) => ({
        url: `/public/driver/verify/${token}/address-photo`,
        method: "DELETE",
        body: { type, url },
      }),
      transformResponse: (r: { data: unknown }) => r.data,
    }),
  }),
});

export const {
  useGetVehiclePublicQuery,
  useGetDriverVerificationQuery,
  useUpdateDriverVerificationMutation,
  useUploadDriverVerifyPhotoMutation,
  useUploadAddressVerifyPhotoMutation,
  useDeleteAddressVerifyPhotoMutation,
} = publicApi;
