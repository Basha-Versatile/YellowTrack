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
  resetPassword: (newPassword: string, confirmPassword: string) =>
    api.post("/auth/reset-password", { newPassword, confirmPassword }),
  // Update the signed-in user's own profile (name + optional profile picture).
  updateProfile: (data: {
    name?: string;
    profileImage?: File | null;
    removeProfileImage?: boolean;
  }) => {
    const fd = new FormData();
    if (data.name) fd.append("name", data.name);
    if (data.profileImage) fd.append("profileImage", data.profileImage);
    if (data.removeProfileImage) fd.append("removeProfileImage", "true");
    return api.patch("/auth/me", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  // ── Forgot-password (OTP via email) ─────────────────────
  forgotPasswordRequest: (email: string) =>
    api.post("/auth/forgot-password/request", { email }),
  forgotPasswordVerify: (email: string, otp: string) =>
    api.post("/auth/forgot-password/verify", { email, otp }),
  forgotPasswordReset: (
    verifyToken: string,
    newPassword: string,
    confirmPassword: string,
  ) =>
    api.post("/auth/forgot-password/reset", {
      verifyToken,
      newPassword,
      confirmPassword,
    }),
};

// ── Current user's tenant (workspace details) ─────────────
type TenantUpdatePayload = {
  name?: string;
  billingEmail?: string | null;
  gstNumber?: string | null;
  panNumber?: string | null;
  addressLine?: string | null;
  city?: string | null;
  state?: string | null;
  pinCode?: string | null;
  // Logo handling. Pass a File to upload a new one; set removeLogo=true to clear.
  logo?: File | null;
  removeLogo?: boolean;
};

export const tenantAPI = {
  getMine: () => api.get("/auth/me/tenant"),
  updateMine: (data: TenantUpdatePayload) => {
    const wantsFileUpload =
      data.logo instanceof File || data.removeLogo === true;
    if (!wantsFileUpload) {
      const { logo: _logo, removeLogo: _rm, ...rest } = data;
      void _logo;
      void _rm;
      return api.patch("/auth/me/tenant", rest);
    }
    const fd = new FormData();
    if (data.name !== undefined) fd.append("name", data.name);
    if (data.billingEmail !== undefined && data.billingEmail !== null)
      fd.append("billingEmail", data.billingEmail);
    if (data.gstNumber !== undefined && data.gstNumber !== null)
      fd.append("gstNumber", data.gstNumber);
    if (data.panNumber !== undefined && data.panNumber !== null)
      fd.append("panNumber", data.panNumber);
    if (data.addressLine !== undefined && data.addressLine !== null)
      fd.append("addressLine", data.addressLine);
    if (data.city !== undefined && data.city !== null)
      fd.append("city", data.city);
    if (data.state !== undefined && data.state !== null)
      fd.append("state", data.state);
    if (data.pinCode !== undefined && data.pinCode !== null)
      fd.append("pinCode", data.pinCode);
    if (data.logo instanceof File) fd.append("logo", data.logo);
    if (data.removeLogo) fd.append("removeLogo", "true");
    return api.patch("/auth/me/tenant", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

// ── Roles & permissions ────────────────────────────────────
export const rolesAPI = {
  list: () => api.get("/roles"),
  get: (id: string) => api.get(`/roles/${id}`),
  create: (data: { name: string; description?: string; permissions: string[] }) =>
    api.post("/roles", data),
  update: (
    id: string,
    data: { name?: string; description?: string | null; permissions?: string[] },
  ) => api.put(`/roles/${id}`, data),
  remove: (id: string) => api.delete(`/roles/${id}`),
};

export const permissionsAPI = {
  get: () => api.get("/permissions"),
};

export const usersAPI = {
  list: () => api.get("/users"),
  invite: (data: {
    name: string;
    email: string;
    roleId?: string | null;
    profileImage?: File | null;
  }) => {
    const fd = new FormData();
    fd.append("name", data.name);
    fd.append("email", data.email);
    if (data.roleId) fd.append("roleId", data.roleId);
    if (data.profileImage) fd.append("profileImage", data.profileImage);
    return api.post("/users", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  update: (
    id: string,
    data: { name?: string; roleId?: string | null },
  ) => api.patch(`/users/${id}`, data),
  remove: (id: string) => api.delete(`/users/${id}`),
  suspend: (id: string) => api.post(`/users/${id}/suspend`),
  resume: (id: string) => api.delete(`/users/${id}/suspend`),
  resetPassword: (id: string) => api.post(`/users/${id}/reset-password`),
};

// ── Superadmin ──────────────────────────────────────────────
export const superadminAPI = {
  getStats: () => api.get("/superadmin/stats"),
  listTenants: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: "ACTIVE" | "SUSPENDED" | "DELETED";
    subscriptionStatus?: "TRIAL" | "ACTIVE" | "EXPIRED" | "CANCELLED";
  }) => api.get("/superadmin/tenants", { params }),
  getTenant: (id: string) => api.get(`/superadmin/tenants/${id}`),
  createTenant: (data: {
    name: string;
    slug: string;
    planId?: string | null;
    billingEmail?: string | null;
    logo?: File | null;
    gstNumber?: string | null;
    panNumber?: string | null;
    addressLine?: string | null;
    city?: string | null;
    state?: string | null;
    pinCode?: string | null;
    admin: { name: string; email: string; profileImage?: File | null };
  }) => {
    const fd = new FormData();
    fd.append("name", data.name);
    fd.append("slug", data.slug);
    if (data.planId) fd.append("planId", data.planId);
    if (data.billingEmail) fd.append("billingEmail", data.billingEmail);
    if (data.logo) fd.append("logo", data.logo);
    if (data.gstNumber) fd.append("gstNumber", data.gstNumber);
    if (data.panNumber) fd.append("panNumber", data.panNumber);
    if (data.addressLine) fd.append("addressLine", data.addressLine);
    if (data.city) fd.append("city", data.city);
    if (data.state) fd.append("state", data.state);
    if (data.pinCode) fd.append("pinCode", data.pinCode);
    fd.append("adminName", data.admin.name);
    fd.append("adminEmail", data.admin.email);
    if (data.admin.profileImage) fd.append("adminProfileImage", data.admin.profileImage);
    return api.post("/superadmin/tenants", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  updateTenant: (
    id: string,
    data: { name?: string; billingEmail?: string | null },
  ) => api.patch(`/superadmin/tenants/${id}`, data),
  suspendTenant: (id: string) => api.post(`/superadmin/tenants/${id}/suspend`),
  resumeTenant: (id: string) => api.delete(`/superadmin/tenants/${id}/suspend`),
  deleteTenant: (id: string) => api.delete(`/superadmin/tenants/${id}`),
  listVehicles: (params?: {
    tenantId?: string;
    page?: number;
    limit?: number;
    search?: string;
    status?: "GREEN" | "YELLOW" | "RED";
  }) => api.get("/superadmin/vehicles", { params }),
  listDrivers: (params?: { tenantId?: string }) =>
    api.get("/superadmin/drivers", { params }),

  // Plans
  listPlans: (params?: { includeInactive?: boolean }) =>
    api.get("/superadmin/plans", {
      params: params?.includeInactive ? { includeInactive: "true" } : undefined,
    }),
  getPlan: (id: string) => api.get(`/superadmin/plans/${id}`),
  createPlan: (data: {
    name: string;
    description?: string | null;
    currency?: string;
    isActive?: boolean;
    fleetSizeMin: number;
    fleetSizeMax?: number | null;
    perVehiclePerMonth: number;
    perVehiclePerYear: number;
    perDriverPerMonth?: number;
    gstPercent?: number;
  }) => api.post("/superadmin/plans", data),
  updatePlan: (
    id: string,
    data: Partial<{
      name: string;
      description: string | null;
      currency: string;
      isActive: boolean;
      fleetSizeMin: number;
      fleetSizeMax: number | null;
      perVehiclePerMonth: number;
      perVehiclePerYear: number;
      perDriverPerMonth: number;
      gstPercent: number;
    }>,
  ) => api.patch(`/superadmin/plans/${id}`, data),
  deactivatePlan: (id: string) => api.delete(`/superadmin/plans/${id}`),
  reactivatePlan: (id: string) => api.post(`/superadmin/plans/${id}`),

  // Tenant subscription actions
  getTenantQuota: (tenantId: string) =>
    api.get(`/superadmin/tenants/${tenantId}/quota`),
  getTenantUsers: (tenantId: string) =>
    api.get(`/superadmin/tenants/${tenantId}/users`),
  getTenantRoles: (tenantId: string) =>
    api.get(`/superadmin/tenants/${tenantId}/roles`),
  changeTenantPlan: (tenantId: string, planId: string) =>
    api.patch(`/superadmin/tenants/${tenantId}/plan`, { planId }),
  renewTenantSubscription: (tenantId: string) =>
    api.post(`/superadmin/tenants/${tenantId}/renew`),
  cancelTenantSubscription: (tenantId: string) =>
    api.delete(`/superadmin/tenants/${tenantId}/renew`),

  // Platform settings (singleton)
  getSettings: () => api.get("/superadmin/settings"),
  updateSettings: (data: { trialDays?: number }) =>
    api.patch("/superadmin/settings", data),
};

// ── Vehicles ────────────────────────────────────────────────
export const vehicleAPI = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    groupId?: string;
    vehicleUsage?: "PRIVATE" | "COMMERCIAL";
    lifecycle?: "ACTIVE" | "SOLD";
    brand?: string;
  }) => api.get("/vehicles", { params }),
  getSale: (vehicleId: string) => api.get(`/vehicles/${vehicleId}/sale`),
  markSold: (vehicleId: string, formData: FormData) =>
    api.post(`/vehicles/${vehicleId}/sale`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  cancelSale: (vehicleId: string) => api.delete(`/vehicles/${vehicleId}/sale`),
  requestDeletion: (vehicleId: string) => api.post(`/vehicles/${vehicleId}/deletion/request`),
  confirmDeletion: (vehicleId: string, otp: string) =>
    api.post(`/vehicles/${vehicleId}/deletion/confirm`, { otp }),
  getById: (id: string) => api.get(`/vehicles/${id}`),
  updateGroups: (vehicleId: string, groupIds: string[]) =>
    api.patch(`/vehicles/${vehicleId}/group`, { groupIds }),
  updateBrand: (vehicleId: string, brand: string | null) =>
    api.patch(`/vehicles/${vehicleId}/brand`, { brand }),
  updateUsage: (
    vehicleId: string,
    vehicleUsage: "PRIVATE" | "COMMERCIAL" | null,
  ) => api.patch(`/vehicles/${vehicleId}/usage`, { vehicleUsage }),
  onboard: (
    registrationNumber: string,
    images?: File[],
    groupIds?: string[],
    vehicleUsage?: "PRIVATE" | "COMMERCIAL",
  ) => {
    const formData = new FormData();
    formData.append("registrationNumber", registrationNumber);
    if (groupIds && groupIds.length > 0) {
      formData.append("groupIds", JSON.stringify(groupIds));
    }
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
  upsertTyres: (vehicleId: string, tyres: Array<{ position: string; size?: string; brand?: string | null }>, tyreCount?: number) =>
    api.put(`/vehicles/${vehicleId}/tyres`, { tyres, tyreCount }),
  upsertServiceParts: (vehicleId: string, parts: Array<{ name: string; partNumber?: string | null; notes?: string | null }>) =>
    api.put(`/vehicles/${vehicleId}/service-parts`, { parts }),
  getTyreReplacements: (vehicleId: string) =>
    api.get(`/vehicles/${vehicleId}/tyre-replacements`),
  getAccessLog: (vehicleId: string) => api.get(`/vehicles/${vehicleId}/access-log`),
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
  create: (data: { name: string; icon: string; color?: string; order?: number; requiredDocTypeIds?: string[] }) =>
    api.post("/vehicle-groups", data),
  update: (id: string, data: { name?: string; icon?: string; color?: string; order?: number; requiredDocTypeIds?: string[] }) =>
    api.put(`/vehicle-groups/${id}`, data),
  remove: (id: string) => api.delete(`/vehicle-groups/${id}`),
};

// ── Document Types ────────────────────────────────────────
export const documentTypeAPI = {
  getAll: () => api.get("/document-types"),
  getById: (id: string) => api.get(`/document-types/${id}`),
  create: (data: { code: string; name: string; description?: string; hasExpiry?: boolean }) =>
    api.post("/document-types", data),
  update: (id: string, data: { code?: string; name?: string; description?: string; hasExpiry?: boolean }) =>
    api.put(`/document-types/${id}`, data),
  remove: (id: string) => api.delete(`/document-types/${id}`),
  // OTP-gated delete: requestDeletion emails the user an OTP, confirmDeletion
  // hands the OTP back to actually remove the row.
  requestDeletion: (id: string) => api.post(`/document-types/${id}/deletion`),
  confirmDeletion: (id: string, otp: string) =>
    api.post(`/document-types/${id}/deletion/confirm`, { otp }),
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
  updateDocExpiry: (docId: string, expiryDate?: string, lifetime?: boolean, issuedDate?: string | null) =>
    api.put(`/drivers/documents/${docId}/expiry`, { expiryDate, lifetime, issuedDate }),
  uploadDocument: (driverId: string, file: File, type: string, expiryDate?: string, lifetime?: boolean, issuedDate?: string) => {
    const formData = new FormData();
    formData.append("document", file);
    formData.append("type", type);
    if (issuedDate) formData.append("issuedDate", issuedDate);
    if (expiryDate) formData.append("expiryDate", expiryDate);
    if (lifetime) formData.append("lifetime", "true");
    return api.post(`/drivers/${driverId}/documents`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  getDocHistory: (driverId: string, type: string) =>
    api.get(`/drivers/${driverId}/documents/history/${type}`),
  sendVerifyLink: (driverId: string, token: string, email?: string) =>
    api.post(`/drivers/${driverId}/verify-link`, { token, email }),
  getChangeLog: (driverId: string) => api.get(`/drivers/${driverId}/changes`),
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
  uploadProfilePhoto: (driverId: string, file: File) => {
    const formData = new FormData();
    formData.append("photo", file);
    return api.post(`/drivers/${driverId}/profile-image`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  uploadAddressPhoto: (driverId: string, type: "current" | "permanent", file: File) => {
    const formData = new FormData();
    formData.append("photo", file);
    return api.post(`/drivers/${driverId}/address-photo/${type}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  deleteAddressPhoto: (driverId: string, type: "current" | "permanent", url: string) => {
    const formData = new FormData();
    formData.append("url", url);
    return api.delete(`/drivers/${driverId}/address-photo/${type}`, {
      data: formData,
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  getMedicalInsuranceProviders: () =>
    api.get<{ data: string[] }>("/drivers/medical-insurance-providers"),
};

// ── Activity log ────────────────────────────────────────────
// ── Vehicle brands (tenant-scoped + superadmin masters) ─────
export const vehicleBrandAPI = {
  // Tenant: list APPROVED brands + own PENDING ones.
  list: () => api.get("/vehicle-brands"),
  // Tenant: request a new brand (creates PENDING + emails superadmin).
  request: (data: { name: string; iconKey?: string | null; description?: string | null }) =>
    api.post("/vehicle-brands", data),
};

export const superadminVehicleBrandAPI = {
  list: (params?: { status?: "APPROVED" | "PENDING" | "REJECTED"; search?: string }) =>
    api.get("/superadmin/vehicle-brands", { params }),
  create: (data: {
    name: string;
    logo?: File | null;
    iconKey?: string | null;
    description?: string | null;
  }) => {
    const fd = new FormData();
    fd.append("name", data.name);
    if (data.logo) fd.append("logo", data.logo);
    if (data.iconKey) fd.append("iconKey", data.iconKey);
    if (data.description) fd.append("description", data.description);
    return api.post("/superadmin/vehicle-brands", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  update: (
    id: string,
    data: {
      name?: string;
      logo?: File | null;
      iconKey?: string | null;
      description?: string | null;
    },
  ) => {
    const fd = new FormData();
    if (data.name !== undefined) fd.append("name", data.name);
    if (data.logo) fd.append("logo", data.logo);
    if (data.iconKey !== undefined) fd.append("iconKey", data.iconKey ?? "");
    if (data.description !== undefined) fd.append("description", data.description ?? "");
    return api.patch(`/superadmin/vehicle-brands/${id}`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  remove: (id: string) => api.delete(`/superadmin/vehicle-brands/${id}`),
  approve: (id: string) => api.post(`/superadmin/vehicle-brands/${id}/approve`),
  reject: (id: string, reason?: string) =>
    api.post(`/superadmin/vehicle-brands/${id}/reject`, { reason: reason ?? "" }),
};

export const activityLogAPI = {
  list: (params: {
    page?: number;
    limit?: number;
    userId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    search?: string;
    from?: string;
    to?: string;
  } = {}) =>
    api.get("/activity-log", { params }),
  // Reverse a recorded action. Pass `force: true` to override the conflict
  // check when the entity has been edited after the log entry.
  revert: (id: string, opts: { force?: boolean } = {}) =>
    api.post(`/activity-log/${id}/revert${opts.force ? "?force=1" : ""}`),
};

// ── Compliance ──────────────────────────────────────────────
export const complianceAPI = {
  uploadDocument: (docId: string, files: File | File[]) => {
    const list = Array.isArray(files) ? files : [files];
    const formData = new FormData();
    for (const f of list) formData.append("document", f);
    return api.post(`/compliance/${docId}/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  removeDocumentFile: (docId: string, url: string) =>
    api.delete(`/compliance/${docId}/upload`, { data: { url } }),
  updateExpiry: (docId: string, data: { type: string; issuedDate?: string | null; expiryDate?: string; lifetime?: boolean }) =>
    api.put(`/compliance/${docId}`, data),
  renewDocument: (docId: string, data: { expiryDate?: string; type: string; lifetime?: boolean }, files?: File | File[]) => {
    const formData = new FormData();
    if (data.expiryDate) formData.append("expiryDate", data.expiryDate);
    formData.append("type", data.type);
    if (data.lifetime) formData.append("lifetime", "true");
    if (files) {
      const list = Array.isArray(files) ? files : [files];
      for (const f of list) formData.append("document", f);
    }
    return api.post(`/compliance/${docId}/renew`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  getHistory: (vehicleId: string, type: string) =>
    api.get(`/compliance/history/${vehicleId}/${type}`),
  // Attach a past-version document (own issued + expiry dates) to the same
  // vehicle + type. Created as isActive=false so the active doc still drives
  // the compliance status; the past version surfaces only in History.
  addHistoricVersion: (
    docId: string,
    data: { file: File; issuedDate?: string; expiryDate?: string },
  ) => {
    const fd = new FormData();
    fd.append("document", data.file);
    if (data.issuedDate) fd.append("issuedDate", data.issuedDate);
    if (data.expiryDate) fd.append("expiryDate", data.expiryDate);
    return api.post(`/compliance/${docId}/historic`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  createDocument: (vehicleId: string, data: { type: string; issuedDate?: string; expiryDate?: string; lifetime?: boolean }, file?: File) => {
    const formData = new FormData();
    formData.append("type", data.type);
    if (data.issuedDate) formData.append("issuedDate", data.issuedDate);
    if (data.expiryDate) formData.append("expiryDate", data.expiryDate);
    if (data.lifetime) formData.append("lifetime", "true");
    if (file) formData.append("document", file);
    return api.post(`/vehicles/${vehicleId}/compliance`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  removeDocument: (docId: string) => api.delete(`/compliance/${docId}`),
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

// ── Feature Suggestions ─────────────────────────────────────
export const featureSuggestionAPI = {
  create: (data: {
    title: string;
    description: string;
    category?: string;
    priority?: string;
  }) => api.post("/feature-suggestions", data),
  getMine: () => api.get("/feature-suggestions"),
};

// ── Notifications ───────────────────────────────────────────
export const notificationAPI = {
  getAll: (params?: { page?: number; limit?: number; unreadOnly?: boolean }) =>
    api.get("/notifications", { params }),
  getUnreadCount: () => api.get("/notifications/unread-count"),
  markAsRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put("/notifications/read-all"),
  // Outbound alert delivery (email / WhatsApp)
  sendTest: (channel: "email" | "whatsapp", to?: string) =>
    api.post("/notifications/test", { channel, to }),
  getDeliveryLog: (limit = 50) =>
    api.get("/notifications/logs", { params: { limit } }),
};

// ── EMI tracking ────────────────────────────────────────
// ── Debit accounts (saved EMI autopay sources) ─────────────
export const debitAccountAPI = {
  list: () => api.get("/debit-accounts"),
};

export const emiAPI = {
  // Cross-vehicle hub for /vehicles/emi
  getHub: (params?: { status?: string; dueWithin?: number }) =>
    api.get("/emi", { params }),

  // Vehicle-scoped
  getForVehicle: (vehicleId: string) => api.get(`/vehicles/${vehicleId}/emi`),
  create: (
    vehicleId: string,
    data: {
      lenderName: string;
      lenderType?: "BANK" | "NBFC" | "PARTNER";
      lenderContactPhone?: string | null;
      lenderBranch?: string | null;
      debitBankName?: string | null;
      debitAccountMasked?: string | null;
      debitAccountHolder?: string | null;
      principalAmount?: number | null;
      emiAmount: number;
      totalInstallments: number;
      startDate: string;
      dueDayOfMonth: number;
      reminderChannels?: Array<"EMAIL" | "WHATSAPP" | "IN_APP">;
      reminderLeadDays?: number[];
      notes?: string | null;
      // Multi-file schedule upload. `scheduleDocuments` is the preferred
      // input; `scheduleDocument` (singular) is kept for callers that still
      // pass one file.
      scheduleDocument?: File | null;
      scheduleDocuments?: File[] | null;
    },
  ) => {
    // Always multipart so the optional schedule file flows through alongside
    // the JSON-ish form fields.
    const fd = new FormData();
    fd.append("lenderName", data.lenderName);
    if (data.lenderType) fd.append("lenderType", data.lenderType);
    if (data.lenderContactPhone) fd.append("lenderContactPhone", data.lenderContactPhone);
    if (data.lenderBranch) fd.append("lenderBranch", data.lenderBranch);
    if (data.debitBankName) fd.append("debitBankName", data.debitBankName);
    if (data.debitAccountMasked) fd.append("debitAccountMasked", data.debitAccountMasked);
    if (data.debitAccountHolder) fd.append("debitAccountHolder", data.debitAccountHolder);
    if (data.principalAmount != null) fd.append("principalAmount", String(data.principalAmount));
    fd.append("emiAmount", String(data.emiAmount));
    fd.append("totalInstallments", String(data.totalInstallments));
    fd.append("startDate", data.startDate);
    fd.append("dueDayOfMonth", String(data.dueDayOfMonth));
    if (data.reminderChannels) fd.append("reminderChannels", JSON.stringify(data.reminderChannels));
    if (data.reminderLeadDays) fd.append("reminderLeadDays", JSON.stringify(data.reminderLeadDays));
    if (data.notes) fd.append("notes", data.notes);
    // Append every schedule file under the same field name — the server uses
    // manyFiles() to collect them as an array. Singular `scheduleDocument`
    // stays supported for old callers.
    if (data.scheduleDocuments) {
      for (const f of data.scheduleDocuments) fd.append("scheduleDocument", f);
    }
    if (data.scheduleDocument) fd.append("scheduleDocument", data.scheduleDocument);
    return api.post(`/vehicles/${vehicleId}/emi`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  // Per-plan
  getPlan: (planId: string) => api.get(`/emi/${planId}`),
  updatePlan: (
    planId: string,
    patch: Partial<{
      lenderName: string;
      lenderType: "BANK" | "NBFC" | "PARTNER";
      lenderContactPhone: string | null;
      lenderBranch: string | null;
      debitBankName: string | null;
      debitAccountMasked: string | null;
      debitAccountHolder: string | null;
      reminderChannels: Array<"EMAIL" | "WHATSAPP" | "IN_APP">;
      reminderLeadDays: number[];
      notes: string | null;
      status: "ACTIVE" | "PAUSED" | "DEFAULTED" | "CLOSED";
    }>,
  ) => api.patch(`/emi/${planId}`, patch),

  // Payments
  markPaid: (
    planId: string,
    paymentId: string,
    data: {
      paidDate?: string;
      paidAmount?: number;
      lateFee?: number;
      transactionRef?: string | null;
      proofUrl?: string | null;
      notes?: string | null;
    },
  ) =>
    api.post(`/emi/${planId}/payments/${paymentId}`, {
      action: "mark-paid",
      ...data,
    }),
  markPaymentStatus: (
    planId: string,
    paymentId: string,
    status: "BOUNCED" | "SKIPPED" | "OVERDUE",
    notes?: string | null,
  ) =>
    api.post(`/emi/${planId}/payments/${paymentId}`, {
      action: "mark-status",
      status,
      notes: notes ?? null,
    }),
  markUnpaid: (planId: string, paymentId: string) =>
    api.post(`/emi/${planId}/payments/${paymentId}`, {
      action: "mark-unpaid",
    }),
  markAllPaidUntil: (planId: string, untilDate?: string) =>
    api.post(`/emi/${planId}`, {
      action: "mark-paid-until",
      ...(untilDate ? { untilDate } : {}),
    }),
};

// ── Public (no auth) ────────────────────────────────────────
export const publicAPI = {
  getVehicle: (id: string) => api.get(`/public/vehicles/${id}`),
  logVehicleAccess: (id: string, data: { target: string; action: "VIEW" | "DOWNLOAD"; documentUrl?: string | null; accessorName?: string | null; accessorPhone?: string | null }) =>
    api.post(`/public/vehicles/${id}/access`, data),
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
  getMedicalInsuranceProviders: (token: string) =>
    api.get<{ data: string[] }>(`/public/driver/verify/${token}/medical-insurance-providers`),
};

export default api;
