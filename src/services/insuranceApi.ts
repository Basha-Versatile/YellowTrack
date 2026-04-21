import { baseApi } from "./api";
import type {
  GetInsuranceQuery,
  PurchaseInsuranceInput,
  SavePolicyInput,
} from "@/validations/insurance.schema";

type Policy = { _id: string; [key: string]: unknown };

export const insuranceApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    listPolicies: b.query<unknown, GetInsuranceQuery | void>({
      query: (params) => ({ url: "/insurance", params: params ?? undefined }),
      transformResponse: (r: { data: unknown }) => r.data,
      providesTags: [{ type: "Insurance", id: "LIST" }],
    }),
    getInsuranceStats: b.query<unknown, void>({
      query: () => "/insurance/stats",
      transformResponse: (r: { data: unknown }) => r.data,
    }),
    getPoliciesByVehicle: b.query<unknown, string>({
      query: (vehicleId) => `/insurance/vehicle/${vehicleId}`,
      transformResponse: (r: { data: unknown }) => r.data,
    }),
    getPolicy: b.query<Policy, string>({
      query: (id) => `/insurance/${id}`,
      transformResponse: (r: { data: Policy }) => r.data,
      providesTags: (_r, _e, id) => [{ type: "Insurance", id }],
    }),
    uploadInsurancePdf: b.mutation<
      unknown,
      { vehicleId: string; file: File }
    >({
      query: ({ vehicleId, file }) => {
        const fd = new FormData();
        fd.append("vehicleId", vehicleId);
        fd.append("document", file);
        return { url: "/insurance/upload", method: "POST", body: fd };
      },
      transformResponse: (r: { data: unknown }) => r.data,
      invalidatesTags: [{ type: "Insurance", id: "LIST" }],
    }),
    saveInsurancePolicy: b.mutation<Policy, SavePolicyInput>({
      query: (body) => ({ url: "/insurance/save", method: "POST", body }),
      transformResponse: (r: { data: Policy }) => r.data,
      invalidatesTags: [{ type: "Insurance", id: "LIST" }],
    }),
    getInsurancePlans: b.mutation<unknown, { vehicleId: string }>({
      query: (body) => ({ url: "/insurance/plans", method: "POST", body }),
      transformResponse: (r: { data: unknown }) => r.data,
    }),
    purchaseInsurance: b.mutation<unknown, PurchaseInsuranceInput>({
      query: (body) => ({ url: "/insurance/purchase", method: "POST", body }),
      transformResponse: (r: { data: unknown }) => r.data,
      invalidatesTags: [{ type: "Insurance", id: "LIST" }],
    }),
  }),
});

export const {
  useListPoliciesQuery,
  useGetInsuranceStatsQuery,
  useGetPoliciesByVehicleQuery,
  useGetPolicyQuery,
  useUploadInsurancePdfMutation,
  useSaveInsurancePolicyMutation,
  useGetInsurancePlansMutation,
  usePurchaseInsuranceMutation,
} = insuranceApi;
