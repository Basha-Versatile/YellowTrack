import { baseApi } from "./api";

type Payment = { _id: string; [key: string]: unknown };

export const paymentsApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    listPayments: b.query<unknown, { page?: number; limit?: number } | void>({
      query: (params) => ({ url: "/payments", params: params ?? undefined }),
      transformResponse: (r: { data: unknown }) => r.data,
      providesTags: [{ type: "Payment", id: "LIST" }],
    }),
    getPayment: b.query<Payment, string>({
      query: (id) => `/payments/${id}`,
      transformResponse: (r: { data: Payment }) => r.data,
      providesTags: (_r, _e, id) => [{ type: "Payment", id }],
    }),
    paySingle: b.mutation<
      Payment,
      { challanId: string; method?: string; transactionId?: string }
    >({
      query: (body) => ({ url: "/payments/single", method: "POST", body }),
      transformResponse: (r: { data: Payment }) => r.data,
      invalidatesTags: [
        { type: "Payment", id: "LIST" },
        { type: "Challan", id: "LIST" },
      ],
    }),
    payBulk: b.mutation<
      Payment,
      { challanIds: string[]; method?: string; transactionId?: string }
    >({
      query: (body) => ({ url: "/payments/bulk", method: "POST", body }),
      transformResponse: (r: { data: Payment }) => r.data,
      invalidatesTags: [
        { type: "Payment", id: "LIST" },
        { type: "Challan", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useListPaymentsQuery,
  useGetPaymentQuery,
  usePaySingleMutation,
  usePayBulkMutation,
} = paymentsApi;
