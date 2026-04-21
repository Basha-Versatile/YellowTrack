import { baseApi } from "./api";
import type {
  CreateGroupInput,
  UpdateGroupInput,
} from "@/validations/vehicleGroup.schema";

type VehicleGroup = {
  _id: string;
  name: string;
  icon: string;
  color?: string;
  order: number;
  tyreCount: number;
  _count?: { vehicles: number };
  requiredDocTypes?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

export const vehicleGroupsApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    listVehicleGroups: b.query<VehicleGroup[], void>({
      query: () => "/vehicle-groups",
      transformResponse: (r: { data: VehicleGroup[] }) => r.data,
      providesTags: (res) =>
        res
          ? [
              ...res.map(({ _id }) => ({
                type: "VehicleGroup" as const,
                id: _id,
              })),
              { type: "VehicleGroup", id: "LIST" },
            ]
          : [{ type: "VehicleGroup", id: "LIST" }],
    }),
    getVehicleGroup: b.query<VehicleGroup, string>({
      query: (id) => `/vehicle-groups/${id}`,
      transformResponse: (r: { data: VehicleGroup }) => r.data,
      providesTags: (_r, _e, id) => [{ type: "VehicleGroup", id }],
    }),
    createVehicleGroup: b.mutation<VehicleGroup, CreateGroupInput>({
      query: (body) => ({ url: "/vehicle-groups", method: "POST", body }),
      transformResponse: (r: { data: VehicleGroup }) => r.data,
      invalidatesTags: [{ type: "VehicleGroup", id: "LIST" }],
    }),
    updateVehicleGroup: b.mutation<
      VehicleGroup,
      { id: string; data: UpdateGroupInput }
    >({
      query: ({ id, data }) => ({
        url: `/vehicle-groups/${id}`,
        method: "PUT",
        body: data,
      }),
      transformResponse: (r: { data: VehicleGroup }) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "VehicleGroup", id },
        { type: "VehicleGroup", id: "LIST" },
      ],
    }),
    deleteVehicleGroup: b.mutation<null, string>({
      query: (id) => ({ url: `/vehicle-groups/${id}`, method: "DELETE" }),
      transformResponse: () => null,
      invalidatesTags: (_r, _e, id) => [
        { type: "VehicleGroup", id },
        { type: "VehicleGroup", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useListVehicleGroupsQuery,
  useGetVehicleGroupQuery,
  useCreateVehicleGroupMutation,
  useUpdateVehicleGroupMutation,
  useDeleteVehicleGroupMutation,
} = vehicleGroupsApi;
