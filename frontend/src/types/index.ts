export type Role = "ADMIN" | "SALES" | "WAREHOUSE" | "ACCOUNTS";

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export interface Customer {
  id: number;
  name: string;
  mobile: string;
  email?: string | null;
  businessName: string;
  gstNumber?: string | null;
  type: string;
  address: string;
  status: string;
  followUpDate?: string | null;
  notes?: string | null;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  category: string;
  unitPrice: string | number;
  currentStock: number;
  minStockQty: number;
  warehouse: string;
}
