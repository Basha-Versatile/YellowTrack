import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

// On Vercel, NEXT_PUBLIC_API_URL should be `/api` (same-origin). If the env var
// is missing the safe default is also `/api`: both local `npm run dev` and
// production Vercel deploys serve the API from the same Next.js app.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

// ── Token storage (access token only — refresh token is in httpOnly cookie) ──

let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      localStorage.setItem("accessToken", token);
    } else {
      localStorage.removeItem("accessToken");
    }
  }
};

export const getAccessToken = (): string | null => {
  if (accessToken) return accessToken;
  if (typeof window !== "undefined") {
    accessToken = localStorage.getItem("accessToken");
  }
  return accessToken;
};

export const clearTokens = () => {
  accessToken = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
  }
};

// ── Request interceptor: attach access token ────────────────

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: silent refresh on 401 ─────────────

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/login") &&
      !originalRequest.url?.includes("/auth/register") &&
      !originalRequest.url?.includes("/auth/refresh")
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const newAccessToken = res.data.data.accessToken;
        setAccessToken(newAccessToken);

        if (res.data.data.user && typeof window !== "undefined") {
          localStorage.setItem("user", JSON.stringify(res.data.data.user));
        }

        processQueue(null, newAccessToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearTokens();
        if (typeof window !== "undefined") {
          window.location.href = "/auth";
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ── Auth ────────────────────────────────────────────────────
export const authAPI = {
  login: (data: { email: string; password: string }) =>
    api.post("/auth/login", data),
  register: (data: { name: string; email: string; password: string }) =>
    api.post("/auth/register", data),
  refresh: () => api.post("/auth/refresh"),
  logout: () => api.post("/auth/logout"),
  logoutAll: () => api.post("/auth/logout-all"),
};

// ── Vehicles ────────────────────────────────────────────────
export const vehicleAPI = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    groupId?: string;
  }) => api.get("/vehicles", { params }),
  getById: (id: string) => api.get(`/vehicles/${id}`),
  updateGroup: (vehicleId: string, groupId: string | null) =>
    api.patch(`/vehicles/${vehicleId}/group`, { groupId }),
  onboard: (
    registrationNumber: string,
    images?: File[],
    groupId?: string,
    vehicleUsage?: "PRIVATE" | "COMMERCIAL",
  ) => {
    const formData = new FormData();
    formData.append("registrationNumber", registrationNumber);
    if (groupId) formData.append("groupId", groupId);
    if (vehicleUsage) formData.append("vehicleUsage", vehicleUsage);
    if (images) images.forEach((f) => formData.append("vehicleImages", f));
    return api.post("/vehicles/onboard", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  getStats: () => api.get("/vehicles/stats"),
  getCompliance: (id: string) => api.get(`/vehicles/${id}/compliance`),
  getChallans: (id: string) => api.get(`/vehicles/${id}/challans`),
  syncChallans: (id: string) => api.post(`/vehicles/${id}/challans/sync`),
  uploadInvoice: (vehicleId: string, file: File) => {
    const formData = new FormData();
    formData.append("invoice", file);
    return api.post(`/vehicles/${vehicleId}/invoice`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  deleteImage: (vehicleId: string, imageUrl: string) =>
    api.delete(`/vehicles/${vehicleId}/images`, { data: { imageUrl } }),
  setProfileImage: (vehicleId: string, imageUrl: string) =>
    api.put(`/vehicles/${vehicleId}/profile-image`, { imageUrl }),
  uploadImages: (vehicleId: string, files: File[]) => {
    const formData = new FormData();
    files.forEach((f) => formData.append("vehicleImages", f));
    return api.post(`/vehicles/${vehicleId}/images`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  onboardManual: (data: Record<string, string | File | undefined>, vehicleImages?: File[]) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, val]) => {
      if (val !== undefined && val !== "") {
        formData.append(key, val);
      }
    });
    if (vehicleImages) vehicleImages.forEach((f) => formData.append("vehicleImages", f));
    return api.post("/vehicles/onboard-manual", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  upsertTyres: (vehicleId: string, tyres: Array<{ position: string; brand?: string; size?: string; installedAt?: string; kmAtInstall?: number; condition?: string }>) =>
    api.put(`/vehicles/${vehicleId}/tyres`, { tyres }),
  // Services
  getAllServices: (params?: { status?: string; vehicleId?: string }) => api.get("/vehicles/services/all", { params }),
  getServices: (vehicleId: string) => api.get(`/vehicles/${vehicleId}/services`),
  createService: (vehicleId: string, formData: FormData) =>
    api.post(`/vehicles/${vehicleId}/services`, formData, { headers: { "Content-Type": "multipart/form-data" } }),
  updateService: (vehicleId: string, serviceId: string, formData: FormData) =>
    api.put(`/vehicles/${vehicleId}/services/${serviceId}`, formData, { headers: { "Content-Type": "multipart/form-data" } }),
  deleteService: (vehicleId: string, serviceId: string) =>
    api.delete(`/vehicles/${vehicleId}/services/${serviceId}`),
  // Expenses
  getExpenseReport: (params?: { vehicleId?: string; from?: string; to?: string }) =>
    api.get("/vehicles/expenses/report", { params }),
  getExpenses: (vehicleId: string, params?: { from?: string; to?: string; category?: string }) =>
    api.get(`/vehicles/${vehicleId}/expenses`, { params }),
  createExpense: (vehicleId: string, formData: FormData) =>
    api.post(`/vehicles/${vehicleId}/expenses`, formData, { headers: { "Content-Type": "multipart/form-data" } }),
  updateExpense: (vehicleId: string, expenseId: string, formData: FormData) =>
    api.put(`/vehicles/${vehicleId}/expenses/${expenseId}`, formData, { headers: { "Content-Type": "multipart/form-data" } }),
  deleteExpense: (vehicleId: string, expenseId: string) =>
    api.delete(`/vehicles/${vehicleId}/expenses/${expenseId}`),
};

// ── Vehicle Groups ─────────────────────────────────────────
export const vehicleGroupAPI = {
  getAll: () => api.get("/vehicle-groups"),
  getById: (id: string) => api.get(`/vehicle-groups/${id}`),
  create: (data: { name: string; icon: string; color?: string; order?: number; tyreCount?: number; requiredDocTypeIds?: string[] }) =>
    api.post("/vehicle-groups", data),
  update: (id: string, data: { name?: string; icon?: string; color?: string; order?: number; tyreCount?: number; requiredDocTypeIds?: string[] }) =>
    api.put(`/vehicle-groups/${id}`, data),
  remove: (id: string) => api.delete(`/vehicle-groups/${id}`),
};

// ── Document Types ────────────────────────────────────────
export const documentTypeAPI = {
  getAll: () => api.get("/document-types"),
  getById: (id: string) => api.get(`/document-types/${id}`),
  getByGroupId: (groupId: string) => api.get(`/document-types/by-group/${groupId}`),
  create: (data: { code: string; name: string; description?: string; hasExpiry?: boolean }) =>
    api.post("/document-types", data),
  update: (id: string, data: { name?: string; description?: string; hasExpiry?: boolean }) =>
    api.put(`/document-types/${id}`, data),
  remove: (id: string) => api.delete(`/document-types/${id}`),
};

// ── Drivers ─────────────────────────────────────────────────
export const driverAPI = {
  getAll: () => api.get("/drivers"),
  getById: (id: string) => api.get(`/drivers/${id}`),
  getStats: () => api.get("/drivers/stats"),
  create: (data: Record<string, unknown>) => api.post("/drivers", data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/drivers/${id}`, data),
  autoCreate: (licenseNumber: string, dob?: string) =>
    api.post("/drivers/auto", dob ? { licenseNumber, dob } : { licenseNumber }),
  toggleVerification: (id: string) => api.patch(`/drivers/${id}/toggle-verification`),
  updateDocExpiry: (docId: string, expiryDate?: string, lifetime?: boolean) =>
    api.put(`/drivers/documents/${docId}/expiry`, { expiryDate, lifetime }),
  uploadDocument: (driverId: string, file: File, type: string, expiryDate?: string, lifetime?: boolean) => {
    const formData = new FormData();
    formData.append("document", file);
    formData.append("type", type);
    if (expiryDate) formData.append("expiryDate", expiryDate);
    if (lifetime) formData.append("lifetime", "true");
    return api.post(`/drivers/${driverId}/documents`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  getDocHistory: (driverId: string, type: string) =>
    api.get(`/drivers/${driverId}/documents/history/${type}`),
  renewDocument: (driverId: string, docId: string, data: { expiryDate?: string; type: string; lifetime?: boolean }, file?: File) => {
    const formData = new FormData();
    if (data.expiryDate) formData.append("expiryDate", data.expiryDate);
    formData.append("type", data.type);
    if (data.lifetime) formData.append("lifetime", "true");
    if (file) formData.append("document", file);
    return api.post(`/drivers/${driverId}/documents/${docId}/renew`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

// ── Compliance ──────────────────────────────────────────────
export const complianceAPI = {
  uploadDocument: (docId: string, file: File) => {
    const formData = new FormData();
    formData.append("document", file);
    return api.post(`/compliance/${docId}/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  updateExpiry: (docId: string, data: { type: string; expiryDate?: string; lifetime?: boolean }) =>
    api.put(`/compliance/${docId}`, data),
  renewDocument: (docId: string, data: { expiryDate?: string; type: string; lifetime?: boolean }, file?: File) => {
    const formData = new FormData();
    if (data.expiryDate) formData.append("expiryDate", data.expiryDate);
    formData.append("type", data.type);
    if (data.lifetime) formData.append("lifetime", "true");
    if (file) formData.append("document", file);
    return api.post(`/compliance/${docId}/renew`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  getHistory: (vehicleId: string, type: string) =>
    api.get(`/compliance/history/${vehicleId}/${type}`),
};

// ── Insurance ──────────────────────────────────────────────
export const insuranceAPI = {
  getAll: (params?: { page?: number; limit?: number; status?: string; search?: string }) =>
    api.get("/insurance", { params }),
  getStats: () => api.get("/insurance/stats"),
  getById: (id: string) => api.get(`/insurance/${id}`),
  getByVehicle: (vehicleId: string) => api.get(`/insurance/vehicle/${vehicleId}`),
  upload: (vehicleId: string, file: File) => {
    const formData = new FormData();
    formData.append("vehicleId", vehicleId);
    formData.append("document", file);
    return api.post("/insurance/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
  },
  save: (data: Record<string, unknown>) => api.post("/insurance/save", data),
  getPlans: (vehicleId: string) => api.post("/insurance/plans", { vehicleId }),
  purchase: (data: { vehicleId: string; provider: string; planName: string; premium: number; coverage?: string[]; addOns?: string[]; paymentMethod?: string }) =>
    api.post("/insurance/purchase", data),
};

// ── FASTag ─────────────────────────────────────────────────
export const fastagAPI = {
  getAll: (params?: { page?: number; limit?: number; status?: string; search?: string }) =>
    api.get("/fastags", { params }),
  getStats: () => api.get("/fastags/stats"),
  getById: (id: string) => api.get(`/fastags/${id}`),
  getByVehicle: (vehicleId: string) => api.get(`/fastags/vehicle/${vehicleId}`),
  create: (data: { vehicleId: string; tagId: string; provider?: string; initialBalance?: number }) =>
    api.post("/fastags", data),
  recharge: (id: string, amount: number) =>
    api.post(`/fastags/${id}/recharge`, { amount }),
  getTransactions: (id: string, params?: { page?: number; limit?: number }) =>
    api.get(`/fastags/${id}/transactions`, { params }),
};

// ── Challans ────────────────────────────────────────────────
export const challanAPI = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    vehicleId?: string;
    search?: string;
  }) => api.get("/challans", { params }),
  getStats: () => api.get("/challans/stats"),
  getByVehicle: (vehicleId: string) =>
    api.get(`/vehicles/${vehicleId}/challans`),
  syncByVehicle: (vehicleId: string) =>
    api.post(`/vehicles/${vehicleId}/challans/sync`),
};

// ── Payments ────────────────────────────────────────────────
export const paymentAPI = {
  paySingle: (data: {
    challanId: string;
    method: string;
    transactionId?: string;
  }) => api.post("/payments/single", data),
  payBulk: (data: {
    challanIds: string[];
    method: string;
    transactionId?: string;
  }) => api.post("/payments/bulk", data),
  getAll: (params?: { page?: number; limit?: number }) =>
    api.get("/payments", { params }),
  getById: (id: string) => api.get(`/payments/${id}`),
};

// ── Notifications ───────────────────────────────────────────
export const notificationAPI = {
  getAll: (params?: { page?: number; limit?: number; unreadOnly?: boolean }) =>
    api.get("/notifications", { params }),
  getUnreadCount: () => api.get("/notifications/unread-count"),
  markAsRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put("/notifications/read-all"),
};

// ── Public (no auth) ────────────────────────────────────────
export const publicAPI = {
  getVehicle: (id: string) => api.get(`/public/vehicles/${id}`),
  getDriverVerification: (token: string) => api.get(`/public/driver/verify/${token}`),
  updateDriverVerification: (token: string, data: Record<string, unknown>) =>
    api.put(`/public/driver/verify/${token}`, data),
  uploadDriverPhoto: (token: string, file: File) => {
    const formData = new FormData();
    formData.append("photo", file);
    return api.post(`/public/driver/verify/${token}/photo`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  uploadAddressPhoto: (token: string, type: "current" | "permanent", file: File) => {
    const formData = new FormData();
    formData.append("photo", file);
    return api.post(`/public/driver/verify/${token}/address-photo/${type}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  deleteAddressPhoto: (token: string, type: "current" | "permanent", url: string) =>
    api.delete(`/public/driver/verify/${token}/address-photo`, { data: { type, url } }),
};

export default api;
