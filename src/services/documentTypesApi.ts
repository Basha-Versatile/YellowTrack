import { baseApi } from "./api";
import type {
  CreateDocTypeInput,
  UpdateDocTypeInput,
} from "@/validations/documentType.schema";

type DocumentType = {
  _id: string;
  code: string;
  name: string;
  hasExpiry: boolean;
  isSystem: boolean;
  isActive: boolean;
  [key: string]: unknown;
};

export const documentTypesApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    listDocumentTypes: b.query<DocumentType[], void>({
      query: () => "/document-types",
      transformResponse: (r: { data: DocumentType[] }) => r.data,
      providesTags: (res) =>
        res
          ? [
              ...res.map(({ _id }) => ({
                type: "DocumentType" as const,
                id: _id,
              })),
              { type: "DocumentType", id: "LIST" },
            ]
          : [{ type: "DocumentType", id: "LIST" }],
    }),
    getDocumentType: b.query<DocumentType, string>({
      query: (id) => `/document-types/${id}`,
      transformResponse: (r: { data: DocumentType }) => r.data,
      providesTags: (_r, _e, id) => [{ type: "DocumentType", id }],
    }),
    getDocumentTypesByGroup: b.query<DocumentType[], string>({
      query: (groupId) => `/document-types/by-group/${groupId}`,
      transformResponse: (r: { data: DocumentType[] }) => r.data,
      providesTags: (_r, _e, groupId) => [
        { type: "DocumentType", id: `GROUP_${groupId}` },
      ],
    }),
    createDocumentType: b.mutation<DocumentType, CreateDocTypeInput>({
      query: (body) => ({ url: "/document-types", method: "POST", body }),
      transformResponse: (r: { data: DocumentType }) => r.data,
      invalidatesTags: [{ type: "DocumentType", id: "LIST" }],
    }),
    updateDocumentType: b.mutation<
      DocumentType,
      { id: string; data: UpdateDocTypeInput }
    >({
      query: ({ id, data }) => ({
        url: `/document-types/${id}`,
        method: "PUT",
        body: data,
      }),
      transformResponse: (r: { data: DocumentType }) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "DocumentType", id },
        { type: "DocumentType", id: "LIST" },
      ],
    }),
    deleteDocumentType: b.mutation<null, string>({
      query: (id) => ({ url: `/document-types/${id}`, method: "DELETE" }),
      transformResponse: () => null,
      invalidatesTags: (_r, _e, id) => [
        { type: "DocumentType", id },
        { type: "DocumentType", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useListDocumentTypesQuery,
  useGetDocumentTypeQuery,
  useGetDocumentTypesByGroupQuery,
  useCreateDocumentTypeMutation,
  useUpdateDocumentTypeMutation,
  useDeleteDocumentTypeMutation,
} = documentTypesApi;
