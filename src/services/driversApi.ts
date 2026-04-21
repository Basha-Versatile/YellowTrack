import { baseApi } from "./api";
import type {
  CreateDriverInput,
  UpdateDriverInput,
  AssignDriverInput,
} from "@/validations/driver.schema";

type Driver = {
  _id: string;
  name: string;
  licenseNumber: string;
  [key: string]: unknown;
};

export const driversApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    listDrivers: b.query<Driver[], void>({
      query: () => "/drivers",
      transformResponse: (r: { data: Driver[] }) => r.data,
      providesTags: (res) =>
        res
          ? [
              ...res.map(({ _id }) => ({ type: "Driver" as const, id: _id })),
              { type: "Driver", id: "LIST" },
            ]
          : [{ type: "Driver", id: "LIST" }],
    }),
    getDriver: b.query<Driver, string>({
      query: (id) => `/drivers/${id}`,
      transformResponse: (r: { data: Driver }) => r.data,
      providesTags: (_r, _e, id) => [{ type: "Driver", id }],
    }),
    getDriverStats: b.query<unknown, void>({
      query: () => "/drivers/stats",
      transformResponse: (r: { data: unknown }) => r.data,
    }),
    createDriver: b.mutation<Driver, CreateDriverInput>({
      query: (body) => ({ url: "/drivers", method: "POST", body }),
      transformResponse: (r: { data: Driver }) => r.data,
      invalidatesTags: [{ type: "Driver", id: "LIST" }],
    }),
    autoCreateDriver: b.mutation<Driver, { licenseNumber: string }>({
      query: (body) => ({ url: "/drivers/auto", method: "POST", body }),
      transformResponse: (r: { data: Driver }) => r.data,
      invalidatesTags: [{ type: "Driver", id: "LIST" }],
    }),
    updateDriver: b.mutation<Driver, { id: string; data: UpdateDriverInput }>({
      query: ({ id, data }) => ({ url: `/drivers/${id}`, method: "PUT", body: data }),
      transformResponse: (r: { data: Driver }) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Driver", id },
        { type: "Driver", id: "LIST" },
      ],
    }),
    toggleDriverVerification: b.mutation<Driver, string>({
      query: (id) => ({ url: `/drivers/${id}/toggle-verification`, method: "PATCH" }),
      transformResponse: (r: { data: Driver }) => r.data,
      invalidatesTags: (_r, _e, id) => [{ type: "Driver", id }],
    }),
    assignDriver: b.mutation<
      unknown,
      { id: string; data: AssignDriverInput }
    >({
      query: ({ id, data }) => ({
        url: `/drivers/${id}/assign`,
        method: "POST",
        body: data,
      }),
      transformResponse: (r: { data: unknown }) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Driver", id },
        { type: "Vehicle", id: "LIST" },
      ],
    }),
    uploadDriverDocument: b.mutation<
      unknown,
      {
        id: string;
        file: File;
        type: string;
        expiryDate?: string;
        lifetime?: boolean;
      }
    >({
      query: ({ id, file, type, expiryDate, lifetime }) => {
        const fd = new FormData();
        fd.append("document", file);
        fd.append("type", type);
        if (expiryDate) fd.append("expiryDate", expiryDate);
        if (lifetime) fd.append("lifetime", "true");
        return {
          url: `/drivers/${id}/documents`,
          method: "POST",
          body: fd,
        };
      },
      transformResponse: (r: { data: unknown }) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Driver", id },
        { type: "DriverDocument", id },
      ],
    }),
    updateDocExpiry: b.mutation<
      unknown,
      { docId: string; expiryDate?: string; lifetime?: boolean }
    >({
      query: ({ docId, expiryDate, lifetime }) => ({
        url: `/drivers/documents/${docId}/expiry`,
        method: "PUT",
        body: { expiryDate, lifetime },
      }),
      transformResponse: (r: { data: unknown }) => r.data,
      invalidatesTags: [{ type: "DriverDocument", id: "LIST" }],
    }),
    getDocumentHistory: b.query<unknown, { driverId: string; type: string }>({
      query: ({ driverId, type }) =>
        `/drivers/${driverId}/documents/history/${type}`,
      transformResponse: (r: { data: unknown }) => r.data,
    }),
    renewDriverDocument: b.mutation<
      unknown,
      {
        id: string;
        docId: string;
        type: string;
        expiryDate?: string;
        lifetime?: boolean;
        file?: File;
      }
    >({
      query: ({ id, docId, type, expiryDate, lifetime, file }) => {
        const fd = new FormData();
        fd.append("type", type);
        if (expiryDate) fd.append("expiryDate", expiryDate);
        if (lifetime) fd.append("lifetime", "true");
        if (file) fd.append("document", file);
        return {
          url: `/drivers/${id}/documents/${docId}/renew`,
          method: "POST",
          body: fd,
        };
      },
      transformResponse: (r: { data: unknown }) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Driver", id },
        { type: "DriverDocument", id },
      ],
    }),
  }),
});

export const {
  useListDriversQuery,
  useGetDriverQuery,
  useGetDriverStatsQuery,
  useCreateDriverMutation,
  useAutoCreateDriverMutation,
  useUpdateDriverMutation,
  useToggleDriverVerificationMutation,
  useAssignDriverMutation,
  useUploadDriverDocumentMutation,
  useUpdateDocExpiryMutation,
  useGetDocumentHistoryQuery,
  useRenewDriverDocumentMutation,
} = driversApi;
