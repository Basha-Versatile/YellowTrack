import { baseApi } from "./api";

type ChallanListQuery = {
  page?: number;
  limit?: number;
  status?: string;
  vehicleId?: string;
  search?: string;
};

export const challansApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    listChallans: b.query<unknown, ChallanListQuery | void>({
      query: (params) => ({ url: "/challans", params: params ?? undefined }),
      transformResponse: (r: { data: unknown }) => r.data,
      providesTags: [{ type: "Challan", id: "LIST" }],
    }),
    getChallanStats: b.query<unknown, void>({
      query: () => "/challans/stats",
      transformResponse: (r: { data: unknown }) => r.data,
    }),
  }),
});

export const { useListChallansQuery, useGetChallanStatsQuery } = challansApi;
