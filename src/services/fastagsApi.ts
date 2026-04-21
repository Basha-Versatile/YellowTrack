import { baseApi } from "./api";
import type {
  CreateFastagInput,
  RechargeFastagInput,
  GetFastagsQuery,
} from "@/validations/fastag.schema";

type Fastag = { _id: string; tagId: string; [key: string]: unknown };

export const fastagsApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    listFastags: b.query<unknown, GetFastagsQuery | void>({
      query: (params) => ({ url: "/fastags", params: params ?? undefined }),
      transformResponse: (r: { data: unknown }) => r.data,
      providesTags: [{ type: "Fastag", id: "LIST" }],
    }),
    getFastagStats: b.query<unknown, void>({
      query: () => "/fastags/stats",
      transformResponse: (r: { data: unknown }) => r.data,
    }),
    getFastag: b.query<Fastag, string>({
      query: (id) => `/fastags/${id}`,
      transformResponse: (r: { data: Fastag }) => r.data,
      providesTags: (_r, _e, id) => [{ type: "Fastag", id }],
    }),
    getFastagByVehicle: b.query<Fastag, string>({
      query: (vehicleId) => `/fastags/vehicle/${vehicleId}`,
      transformResponse: (r: { data: Fastag }) => r.data,
    }),
    getFastagTransactions: b.query<
      unknown,
      { id: string; page?: number; limit?: number }
    >({
      query: ({ id, ...params }) => ({
        url: `/fastags/${id}/transactions`,
        params,
      }),
      transformResponse: (r: { data: unknown }) => r.data,
      providesTags: (_r, _e, { id }) => [{ type: "FastagTransaction", id }],
    }),
    createFastag: b.mutation<Fastag, CreateFastagInput>({
      query: (body) => ({ url: "/fastags", method: "POST", body }),
      transformResponse: (r: { data: Fastag }) => r.data,
      invalidatesTags: [{ type: "Fastag", id: "LIST" }],
    }),
    rechargeFastag: b.mutation<
      Fastag,
      { id: string } & RechargeFastagInput
    >({
      query: ({ id, amount }) => ({
        url: `/fastags/${id}/recharge`,
        method: "POST",
        body: { amount },
      }),
      transformResponse: (r: { data: Fastag }) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Fastag", id },
        { type: "FastagTransaction", id },
      ],
    }),
  }),
});

export const {
  useListFastagsQuery,
  useGetFastagStatsQuery,
  useGetFastagQuery,
  useGetFastagByVehicleQuery,
  useGetFastagTransactionsQuery,
  useCreateFastagMutation,
  useRechargeFastagMutation,
} = fastagsApi;
