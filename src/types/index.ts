export type AttendanceState = 'NONE' | 'IN' | 'OUT';

export interface Attendance {
  state: AttendanceState;
  checkIn?: string;
  checkOut?: string;
}

export interface StaffMe {
  name: string;
  attendance: Attendance;
}

export interface LoginResponse {
  token: string;
  name: string;
  role: string;
  shop: string;
}

export interface Product {
  id: number | string;
  name: string;
  barcode: string;
  unit: string;
  price: number;
  mrp?: number;
  gst: number;
  stock: number;
  minStock: number;
}

export interface CatalogResponse {
  items: Product[];
  at: string;
}

export type SosKind = 'HELP' | 'THEFT' | 'FIRE' | 'MEDICAL';

export interface SosAlert {
  id: string;
  kind: SosKind;
  message?: string;
  latitude?: number;
  longitude?: number;
  at: string;
  attempts?: number;
}

export type PaymentMode = 'CASH' | 'UPI' | 'CARD';

export interface BillCartItem {
  id: number | string;
  name: string;
  price: number;
  gst: number;
  stock: number;
  unit: string;
  qty: number;
}

export interface EmergencyBillItem {
  id: number | string;
  qty: number;
  name?: string;
}

export interface EmergencyBill {
  clientId: string;
  madeAt: string;
  paymentMode: PaymentMode;
  items: EmergencyBillItem[];
  total: number;
  error?: string;
}

export interface EmergencyBillResult {
  clientId: string;
  status: 'POSTED' | 'FAILED';
  billNo?: string;
  error?: string;
}

export interface EmergencyBillsResponse {
  results: EmergencyBillResult[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  requestId?: string;
  timestamp?: string;
  error?: {
    message: string;
  };
}

export interface SentScan {
  id: string;
  code: string;
  timestamp: string;
  status: 'POSTED' | 'FAILED';
  error?: string;
}

export type TabType = 'home' | 'scan' | 'stock' | 'bill';
