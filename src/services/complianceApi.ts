import { baseApi } from "./api";

export const complianceApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    updateComplianceExpiry: b.mutation<
      unknown,
      {
        docId: string;
        type: string;
        expiryDate?: string;
        lifetime?: boolean;
      }
    >({
      query: ({ docId, ...data }) => ({
        url: `/compliance/${docId}`,
        method: "PUT",
        body: data,
      }),
      transformResponse: (r: { data: unknown }) => r.data,
      invalidatesTags: [{ type: "Compliance", id: "LIST" }],
    }),
    uploadComplianceDoc: b.mutation<unknown, { docId: string; file: File }>({
      query: ({ docId, file }) => {
        const fd = new FormData();
        fd.append("document", file);
        return { url: `/compliance/${docId}/upload`, method: "POST", body: fd };
      },
      transformResponse: (r: { data: unknown }) => r.data,
      invalidatesTags: [{ type: "Compliance", id: "LIST" }],
    }),
    renewComplianceDoc: b.mutation<
      unknown,
      {
        docId: string;
        type: string;
        expiryDate?: string;
        lifetime?: boolean;
        file?: File;
      }
    >({
      query: ({ docId, type, expiryDate, lifetime, file }) => {
        const fd = new FormData();
        fd.append("type", type);
        if (expiryDate) fd.append("expiryDate", expiryDate);
        if (lifetime) fd.append("lifetime", "true");
        if (file) fd.append("document", file);
        return { url: `/compliance/${docId}/renew`, method: "POST", body: fd };
      },
      transformResponse: (r: { data: unknown }) => r.data,
      invalidatesTags: [{ type: "Compliance", id: "LIST" }],
    }),
    getComplianceHistory: b.query<
      unknown,
      { vehicleId: string; type: string }
    >({
      query: ({ vehicleId, type }) => `/compliance/history/${vehicleId}/${type}`,
      transformResponse: (r: { data: unknown }) => r.data,
    }),
  }),
});

export const {
  useUpdateComplianceExpiryMutation,
  useUploadComplianceDocMutation,
  useRenewComplianceDocMutation,
  useGetComplianceHistoryQuery,
} = complianceApi;
