import { baseApi } from "./api";

type Notification = {
  _id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  [key: string]: unknown;
};

type NotificationListResponse = {
  notifications: Notification[];
  total: number;
  unreadCount: number;
  page: number;
  totalPages: number;
};

export const notificationsApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    listNotifications: b.query<
      NotificationListResponse,
      { page?: number; limit?: number; unreadOnly?: boolean } | void
    >({
      query: (params) => ({
        url: "/notifications",
        params: params ?? undefined,
      }),
      transformResponse: (r: { data: NotificationListResponse }) => r.data,
      providesTags: (res) =>
        res
          ? [
              ...res.notifications.map(({ _id }) => ({
                type: "Notification" as const,
                id: _id,
              })),
              { type: "Notification", id: "LIST" },
            ]
          : [{ type: "Notification", id: "LIST" }],
    }),
    getUnreadCount: b.query<{ count: number }, void>({
      query: () => "/notifications/unread-count",
      transformResponse: (r: { data: { count: number } }) => r.data,
      providesTags: [{ type: "Notification", id: "UNREAD" }],
    }),
    markNotificationRead: b.mutation<null, string>({
      query: (id) => ({ url: `/notifications/${id}/read`, method: "PUT" }),
      transformResponse: () => null,
      invalidatesTags: (_r, _e, id) => [
        { type: "Notification", id },
        { type: "Notification", id: "LIST" },
        { type: "Notification", id: "UNREAD" },
      ],
    }),
    markAllNotificationsRead: b.mutation<null, void>({
      query: () => ({ url: "/notifications/read-all", method: "PUT" }),
      transformResponse: () => null,
      invalidatesTags: [
        { type: "Notification", id: "LIST" },
        { type: "Notification", id: "UNREAD" },
      ],
    }),
  }),
});

export const {
  useListNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} = notificationsApi;
