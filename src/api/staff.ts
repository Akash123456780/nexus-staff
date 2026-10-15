import { apiClient } from './client';
import {
  Attendance,
  CatalogResponse,
  EmergencyBillsResponse,
  LoginResponse,
  Product,
  SosAlert,
  StaffMe,
} from '../types';

export const StaffApi = {
  /**
   * POST /api/v1/staff/login
   */
  async login(username: string, password: string): Promise<LoginResponse> {
    return await apiClient<LoginResponse>('/api/v1/staff/login', {
      method: 'POST',
      body: { username, password },
    });
  },

  /**
   * GET /api/v1/staff/me
   */
  async getMe(): Promise<StaffMe> {
    return await apiClient<StaffMe>('/api/v1/staff/me', {
      method: 'GET',
    });
  },

  /**
   * POST /api/v1/staff/attendance { action: "in" | "out" }
   * Returns attendance object (409 if already in / not in)
   */
  async markAttendance(action: 'in' | 'out'): Promise<Attendance> {
    return await apiClient<Attendance>('/api/v1/staff/attendance', {
      method: 'POST',
      body: { action },
    });
  },

  /**
   * GET /api/v1/staff/products?q=TEXT
   */
  async searchProducts(query: string): Promise<Product[]> {
    const encoded = encodeURIComponent(query.trim());
    return await apiClient<Product[]>(`/api/v1/staff/products?q=${encoded}`, {
      method: 'GET',
    });
  },

  /**
   * GET /api/v1/staff/catalog
   */
  async getCatalog(): Promise<CatalogResponse> {
    return await apiClient<CatalogResponse>('/api/v1/staff/catalog', {
      method: 'GET',
      // Longer timeout for large catalog download
      timeoutMs: 30000,
    });
  },

  /**
   * POST /api/v1/staff/scan { code }
   */
  async sendScan(code: string): Promise<{ message?: string }> {
    return await apiClient<{ message?: string }>('/api/v1/staff/scan', {
      method: 'POST',
      body: { code: code.trim() },
    });
  },

  /**
   * POST /api/v1/staff/sos
   */
  async sendSos(alert: {
    kind: string;
    message?: string;
    latitude?: number;
    longitude?: number;
    at?: string;
  }): Promise<{ message?: string }> {
    return await apiClient<{ message?: string }>('/api/v1/staff/sos', {
      method: 'POST',
      body: alert,
    });
  },

  /**
   * POST /api/v1/staff/emergency-bills
   */
  async postEmergencyBills(
    bills: {
      clientId: string;
      madeAt: string;
      paymentMode: string;
      items: { id: number | string; qty: number }[];
    }[]
  ): Promise<EmergencyBillsResponse> {
    return await apiClient<EmergencyBillsResponse>('/api/v1/staff/emergency-bills', {
      method: 'POST',
      body: { bills },
      timeoutMs: 25000,
    });
  },
};
