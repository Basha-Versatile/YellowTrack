import { baseApi } from "./api";

type Vehicle = {
  _id: string;
  registrationNumber: string;
  [key: string]: unknown;
};
type Pagination = { page: number; limit: number; total: number; totalPages: number };
type VehicleList = { vehicles: Vehicle[]; pagination: Pagination };

type VehicleQuery = {
  page?: number;
  limit?: number;
  search?: string;
  status?: "GREEN" | "YELLOW" | "RED";
  groupId?: string;
};

export const vehiclesApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    listVehicles: b.query<VehicleList, VehicleQuery | void>({
      query: (params) => ({ url: "/vehicles", params: params ?? undefined }),
      transformResponse: (r: { data: VehicleList }) => r.data,
      providesTags: (res) =>
        res
          ? [
              ...res.vehicles.map(({ _id }) => ({ type: "Vehicle" as const, id: _id })),
              { type: "Vehicle", id: "LIST" },
            ]
          : [{ type: "Vehicle", id: "LIST" }],
    }),
    getVehicle: b.query<Vehicle, string>({
      query: (id) => `/vehicles/${id}`,
      transformResponse: (r: { data: Vehicle }) => r.data,
      providesTags: (_r, _e, id) => [{ type: "Vehicle", id }],
    }),
    getVehicleStats: b.query<unknown, void>({
      query: () => "/vehicles/stats",
      transformResponse: (r: { data: unknown }) => r.data,
    }),
    onboardVehicle: b.mutation<
      Vehicle,
      { registrationNumber: string; groupId: string; images?: File[] }
    >({
      query: ({ registrationNumber, groupId, images }) => {
        const fd = new FormData();
        fd.append("registrationNumber", registrationNumber);
        fd.append("groupId", groupId);
        images?.forEach((f) => fd.append("vehicleImages", f));
        return { url: "/vehicles/onboard", method: "POST", body: fd };
      },
      transformResponse: (r: { data: Vehicle }) => r.data,
      invalidatesTags: [{ type: "Vehicle", id: "LIST" }],
    }),
    onboardManual: b.mutation<Vehicle, FormData>({
      query: (body) => ({ url: "/vehicles/onboard-manual", method: "POST", body }),
      transformResponse: (r: { data: Vehicle }) => r.data,
      invalidatesTags: [{ type: "Vehicle", id: "LIST" }],
    }),
    updateVehicleGroup: b.mutation<Vehicle, { id: string; groupId: string | null }>({
      query: ({ id, groupId }) => ({
        url: `/vehicles/${id}/group`,
        method: "PATCH",
        body: { groupId },
      }),
      transformResponse: (r: { data: Vehicle }) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Vehicle", id },
        { type: "Vehicle", id: "LIST" },
      ],
    }),
    uploadVehicleImages: b.mutation<Vehicle, { id: string; files: File[] }>({
      query: ({ id, files }) => {
        const fd = new FormData();
        files.forEach((f) => fd.append("vehicleImages", f));
        return { url: `/vehicles/${id}/images`, method: "POST", body: fd };
      },
      transformResponse: (r: { data: Vehicle }) => r.data,
      invalidatesTags: (_r, _e, { id }) => [{ type: "Vehicle", id }],
    }),
    deleteVehicleImage: b.mutation<Vehicle, { id: string; imageUrl: string }>({
      query: ({ id, imageUrl }) => ({
        url: `/vehicles/${id}/images`,
        method: "DELETE",
        body: { imageUrl },
      }),
      transformResponse: (r: { data: Vehicle }) => r.data,
      invalidatesTags: (_r, _e, { id }) => [{ type: "Vehicle", id }],
    }),
    setProfileImage: b.mutation<Vehicle, { id: string; imageUrl: string }>({
      query: ({ id, imageUrl }) => ({
        url: `/vehicles/${id}/profile-image`,
        method: "PUT",
        body: { imageUrl },
      }),
      transformResponse: (r: { data: Vehicle }) => r.data,
      invalidatesTags: (_r, _e, { id }) => [{ type: "Vehicle", id }],
    }),
    uploadInvoice: b.mutation<Vehicle, { id: string; file: File }>({
      query: ({ id, file }) => {
        const fd = new FormData();
        fd.append("invoice", file);
        return { url: `/vehicles/${id}/invoice`, method: "POST", body: fd };
      },
      transformResponse: (r: { data: Vehicle }) => r.data,
      invalidatesTags: (_r, _e, { id }) => [{ type: "Vehicle", id }],
    }),
    upsertTyres: b.mutation<
      Vehicle,
      {
        id: string;
        tyres: Array<{
          position: string;
          brand?: string;
          size?: string;
          installedAt?: string;
          kmAtInstall?: number;
          condition?: "GOOD" | "AVERAGE" | "REPLACE";
        }>;
      }
    >({
      query: ({ id, tyres }) => ({
        url: `/vehicles/${id}/tyres`,
        method: "PUT",
        body: { tyres },
      }),
      transformResponse: (r: { data: Vehicle }) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Vehicle", id },
        { type: "Tyre", id: "LIST" },
      ],
    }),
    syncChallans: b.mutation<null, string>({
      query: (vehicleId) => ({
        url: `/vehicles/${vehicleId}/challans/sync`,
        method: "POST",
      }),
      transformResponse: () => null,
      invalidatesTags: (_r, _e, id) => [
        { type: "Vehicle", id },
        { type: "Challan", id: "LIST" },
      ],
    }),
    getVehicleCompliance: b.query<unknown, string>({
      query: (id) => `/vehicles/${id}/compliance`,
      transformResponse: (r: { data: unknown }) => r.data,
      providesTags: (_r, _e, id) => [{ type: "Compliance", id }],
    }),
    getVehicleChallans: b.query<unknown, string>({
      query: (id) => `/vehicles/${id}/challans`,
      transformResponse: (r: { data: unknown }) => r.data,
      providesTags: (_r, _e, id) => [{ type: "Challan", id }],
    }),
    // Services
    listAllServices: b.query<
      unknown,
      { status?: string; vehicleId?: string } | void
    >({
      query: (params) => ({ url: "/vehicles/services/all", params: params ?? undefined }),
      transformResponse: (r: { data: unknown }) => r.data,
      providesTags: [{ type: "Service", id: "LIST" }],
    }),
    listServices: b.query<unknown, string>({
      query: (id) => `/vehicles/${id}/services`,
      transformResponse: (r: { data: unknown }) => r.data,
      providesTags: (_r, _e, id) => [{ type: "Service", id }],
    }),
    createService: b.mutation<unknown, { id: string; form: FormData }>({
      query: ({ id, form }) => ({
        url: `/vehicles/${id}/services`,
        method: "POST",
        body: form,
      }),
      transformResponse: (r: { data: unknown }) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Service", id },
        { type: "Service", id: "LIST" },
      ],
    }),
    updateService: b.mutation<
      unknown,
      { id: string; serviceId: string; form: FormData }
    >({
      query: ({ id, serviceId, form }) => ({
        url: `/vehicles/${id}/services/${serviceId}`,
        method: "PUT",
        body: form,
      }),
      transformResponse: (r: { data: unknown }) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Service", id },
        { type: "Service", id: "LIST" },
      ],
    }),
    deleteService: b.mutation<null, { id: string; serviceId: string }>({
      query: ({ id, serviceId }) => ({
        url: `/vehicles/${id}/services/${serviceId}`,
        method: "DELETE",
      }),
      transformResponse: () => null,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Service", id },
        { type: "Service", id: "LIST" },
      ],
    }),
    // Expenses
    getExpenseReport: b.query<
      unknown,
      { vehicleId?: string; from?: string; to?: string } | void
    >({
      query: (params) => ({
        url: "/vehicles/expenses/report",
        params: params ?? undefined,
      }),
      transformResponse: (r: { data: unknown }) => r.data,
      providesTags: [{ type: "Expense", id: "REPORT" }],
    }),
    listExpenses: b.query<
      unknown,
      { id: string; from?: string; to?: string; category?: string }
    >({
      query: ({ id, ...params }) => ({
        url: `/vehicles/${id}/expenses`,
        params,
      }),
      transformResponse: (r: { data: unknown }) => r.data,
      providesTags: (_r, _e, { id }) => [{ type: "Expense", id }],
    }),
    createExpense: b.mutation<unknown, { id: string; form: FormData }>({
      query: ({ id, form }) => ({
        url: `/vehicles/${id}/expenses`,
        method: "POST",
        body: form,
      }),
      transformResponse: (r: { data: unknown }) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Expense", id },
        { type: "Expense", id: "REPORT" },
      ],
    }),
    updateExpense: b.mutation<
      unknown,
      { id: string; expenseId: string; form: FormData }
    >({
      query: ({ id, expenseId, form }) => ({
        url: `/vehicles/${id}/expenses/${expenseId}`,
        method: "PUT",
        body: form,
      }),
      transformResponse: (r: { data: unknown }) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Expense", id },
        { type: "Expense", id: "REPORT" },
      ],
    }),
    deleteExpense: b.mutation<null, { id: string; expenseId: string }>({
      query: ({ id, expenseId }) => ({
        url: `/vehicles/${id}/expenses/${expenseId}`,
        method: "DELETE",
      }),
      transformResponse: () => null,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Expense", id },
        { type: "Expense", id: "REPORT" },
      ],
    }),
  }),
});

export const {
  useListVehiclesQuery,
  useGetVehicleQuery,
  useGetVehicleStatsQuery,
  useOnboardVehicleMutation,
  useOnboardManualMutation,
  useUpdateVehicleGroupMutation,
  useUploadVehicleImagesMutation,
  useDeleteVehicleImageMutation,
  useSetProfileImageMutation,
  useUploadInvoiceMutation,
  useUpsertTyresMutation,
  useSyncChallansMutation,
  useGetVehicleComplianceQuery,
  useGetVehicleChallansQuery,
  useListAllServicesQuery,
  useListServicesQuery,
  useCreateServiceMutation,
  useUpdateServiceMutation,
  useDeleteServiceMutation,
  useGetExpenseReportQuery,
  useListExpensesQuery,
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
} = vehiclesApi;
