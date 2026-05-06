import type {
  ApiListResponse,
  AttendanceRecord,
  DailySummaryRow,
  Notification,
  Payment,
  PaymentRecord,
  Product,
  QueryParams,
  SubscriptionPlan,
  Transaction,
  User,
  VisitRecord,
} from "../types/entities";

const getApiBaseUrl = (): string => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return '/api';
  }
  return import.meta.env.VITE_API_URL || '/api';
};

const API_BASE_URL = getApiBaseUrl();

console.log('🔥 Host:', window.location.host);
console.log('🔥 API_BASE_URL:', API_BASE_URL);

let isAuthenticating = false;

function buildQueryString(params?: QueryParams): string {
  if (!params) return "";
  
  const searchParams = new URLSearchParams();
  
  if (params.page) searchParams.append("page", params.page.toString());
  if (params.itemsPerPage) searchParams.append("itemsPerPage", params.itemsPerPage.toString());
  
  if (params.order) {
    Object.entries(params.order).forEach(([key, value]) => {
      searchParams.append(`order[${key}]`, value);
    });
  }
  
  if (params.search) searchParams.append("search", params.search);
  
  if (params.filters) {
    Object.entries(params.filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach((v) => searchParams.append(`${key}[]`, String(v)));
        } else {
          searchParams.append(key, String(value));
        }
      }
    });
  }
  
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 1
): Promise<Response> {
  try {
    const response = await fetch(url, options);
    if (!response.ok && [500, 502, 503, 504].includes(response.status) && retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return fetchWithRetry(url, options, retries - 1);
    }
    return response;
  } catch (error) {
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}

async function fetchFromApi<T>(
  endpoint: string,
  options: RequestInit = {},
  contentType = "application/ld+json"
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = localStorage.getItem("madafit_token");
  
  console.log('🌐 Fetch URL:', url);
  console.log('🔑 Token présent:', !!token);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const response = await fetchWithRetry(url, {
    signal: controller.signal,
    headers: {
      Accept: "application/ld+json",
      ...(options.body ? { "Content-Type": contentType } : {}),
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    if (response.status === 401 && !isAuthenticating) {
      console.error('🔴 401 reçu sur:', url);
      console.error('🔴 Token:', token?.substring(0, 20) + '...');
      
      localStorage.removeItem("madafit_token");
      localStorage.removeItem("madafit_user");
      window.dispatchEvent(new CustomEvent("madafit:sessionExpired"));
    }

    let details = "";
    try {
      const errorData = await response.json();
      details = errorData["hydra:description"] || errorData.description || errorData.message || errorData.error || JSON.stringify(errorData);
    } catch {
      details = await response.text();
    }

    throw new Error(`API Error ${response.status} ${response.statusText}${details ? ` - ${details}` : ""}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

function createCrudApi<T>(resource: string) {
  return {
    async getAll(params?: QueryParams): Promise<ApiListResponse<T>> {
      const query = buildQueryString(params);
      return fetchFromApi<ApiListResponse<T>>(`/${resource}${query}`);
    },
    async getById(id: string | number): Promise<T> {
      const cleanId = String(id).split('/').pop();
      return fetchFromApi<T>(`/${resource}/${cleanId}`);
    },
    async create(data: Partial<T>): Promise<T> {
      return fetchFromApi<T>(`/${resource}`, {
        method: "POST",
        body: JSON.stringify(data),
      }, "application/ld+json");
    },
    async update(id: string | number, data: Partial<T>): Promise<T> {
      const cleanId = String(id).split('/').pop();
      return fetchFromApi<T>(`/${resource}/${cleanId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }, "application/merge-patch+json");
    },
    async delete(id: string | number): Promise<void> {
      const cleanId = String(id).split('/').pop();
      await fetchFromApi<void>(`/${resource}/${cleanId}`, { method: "DELETE" });
    },
  };
}

export const authApi = {
  async login(credentials: Record<string, string>): Promise<any> {
    isAuthenticating = true;
    
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || "Identifiants incorrects");
      }

      const data = await response.json();
      
      if (!data.token) {
        throw new Error("Token manquant dans la réponse");
      }

      localStorage.setItem("madafit_token", data.token);
      
      try {
        const payload = JSON.parse(atob(data.token.split('.')[1]));
        const userData = {
          id: data.id || payload.id || undefined,
          email: payload.username || payload.email || data.email || "",
          roles: payload.roles || data.roles || [],
          firstName: data.firstName || payload.firstName || (payload.username ? payload.username.split('@')[0] : "Utilisateur"),
          lastName: data.lastName || payload.lastName || "",
          memberId: data.memberId || payload.memberId || undefined,
          status: data.status || payload.status || undefined,
        };
        localStorage.setItem("madafit_user", JSON.stringify(userData));
        
        // Journal des connexions côté client
        try {
          const logs = JSON.parse(localStorage.getItem("madafit_login_logs") || "[]");
          logs.unshift({
            date: new Date().toISOString(),
            userAgent: navigator.userAgent,
            platform: navigator.platform,
          });
          localStorage.setItem("madafit_login_logs", JSON.stringify(logs.slice(0, 10)));
        } catch (e) {
          console.error("Erreur journal connexion", e);
        }
        
        window.dispatchEvent(new Event("storage"));
        return userData;
      } catch (e) {
        console.error("Erreur lors du décodage du token", e);
        throw new Error("Token invalide");
      }
    } finally {
      setTimeout(() => { isAuthenticating = false; }, 500);
    }
  },
  
  logout() {
    isAuthenticating = false;
    localStorage.removeItem("madafit_token");
    localStorage.removeItem("madafit_user");
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new CustomEvent("madafit:sessionExpired"));
  }
};

export const userApi = createCrudApi<User>("users");
export const productApi = createCrudApi<Product>("products");
export const subscriptionPlanApi = createCrudApi<SubscriptionPlan>("subscription_plans");
export const attendanceRecordApi = createCrudApi<AttendanceRecord>("attendance_records");
export const paymentApi = createCrudApi<Payment>("payments");
export const paymentRecordApi = createCrudApi<PaymentRecord>("payment_records");

export const notificationApi = {
  async getAll(params?: { page?: number; itemsPerPage?: number }): Promise<{
    items: Notification[];
    total: number;
    page: number;
    itemsPerPage: number;
    unreadCount: number;
  }> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append("page", String(params.page));
    if (params?.itemsPerPage) searchParams.append("itemsPerPage", String(params.itemsPerPage));
    const qs = searchParams.toString();
    return fetchFromApi(`/notifications${qs ? `?${qs}` : ""}`);
  },

  async getUnreadCount(): Promise<{ count: number }> {
    return fetchFromApi("/notifications/unread-count");
  },

  async markAsRead(id: number): Promise<{ success: boolean }> {
    return fetchFromApi(`/notifications/${id}/read`, { method: "PATCH" });
  },

  async markAllAsRead(): Promise<{ success: boolean }> {
    return fetchFromApi("/notifications/mark-all-read", { method: "POST" });
  },

  async delete(id: number): Promise<void> {
    return fetchFromApi(`/notifications/${id}`, { method: "DELETE" });
  },
};

export const transactionApi = createCrudApi<Transaction>("transactions");
export const visitRecordApi = createCrudApi<VisitRecord>("visit_records");
export const dailySummaryRowApi = createCrudApi<DailySummaryRow>("daily_summary_rows");

export const api = {
  auth: authApi,
  users: userApi,
  products: productApi,
  subscriptionPlans: subscriptionPlanApi,
  attendanceRecords: attendanceRecordApi,
  payments: paymentApi,
  paymentRecords: paymentRecordApi,
  notifications: notificationApi,
  transactions: transactionApi,
  visitRecords: visitRecordApi,
  dailySummaryRows: dailySummaryRowApi,
  stockReports: {
    getSummary: async (params: { from: string; to: string }): Promise<StockReportSummary> => {
      const token = localStorage.getItem("madafit_token");
      if (!token) throw new Error("Vous devez être connecté pour voir les rapports");

      const response = await fetch(`${API_BASE_URL}/stock_summary?from=${params.from}&to=${params.to}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("madafit_token");
          localStorage.removeItem("madafit_user");
          window.dispatchEvent(new CustomEvent("madafit:sessionExpired"));
          throw new Error("Session expirée. Veuillez vous reconnecter.");
        }
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de la récupération du rapport");
      }
      
      return response.json();
    },
  },
};

export function refreshNotifications(): void {
  window.dispatchEvent(new CustomEvent('madafit:refreshNotifications'));
}

export interface StockReportRow {
  product: { id: number; name: string; category: string };
  initialStock: number;
  totalEntries: number;
  totalSales: number;
  totalCredits: number;
  totalNonSaleExits: number;
  totalExits: number;
  finalStock: number;
  totalCost: number;
  revenue: number;
  profit: number;
}

export interface StockReportSummary {
  period: { from: string; to: string; fromFormatted: string; toFormatted: string };
  totals: { 
    initialStock: number; 
    totalEntries: number; 
    totalSales: number; 
    totalCredits: number;
    totalNonSaleExits: number; 
    totalExits: number; 
    finalStock: number; 
    totalCost: number; 
    revenue: number; 
    profit: number; 
  };
  activeProductsCount: number;
  rows: StockReportRow[];
}

console.log('🔥 ENV VITE_API_URL:', import.meta.env.VITE_API_URL);
console.log('🔥 API_BASE_URL:', API_BASE_URL);

export default api;