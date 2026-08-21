export type Role = "ADMIN" | "OPERATIONS_USER" | "SALES_USER";

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export interface InventoryItem {
  id: number;
  item: string;
  category: string;
  location: string;
  batch: string;
  physicalQty: number;
  reservedQty: number;
  availableQty: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkOrder {
  id: number;
  location: string;
  item: string;
  requiredQty: number;
  assignedUserId: number;
  assignedUser?: User;
  status: "ASSIGNED" | "IN_PROGRESS" | "COMPLETED";
  shortageQty: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface InternalTransfer {
  id: number;
  sourceLocation: string;
  destinationLocation: string;
  item: string;
  batch: string;
  quantity: number;
  status: "REQUESTED" | "DISPATCHED" | "RECEIVED";
  createdById: number;
  createdBy?: User;
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomerOrder {
  id: number;
  customerName: string;
  item: string;
  location: string;
  batch: string;
  quantity: number;
  status: "RESERVED" | "COMPLETED" | "CANCELLED";
  createdById: number;
  createdBy?: User;
  createdAt?: string;
  updatedAt?: string;
}

export interface StockLog {
  id: number;
  item: string;
  location: string;
  batch: string;
  quantity: number;
  reservedChange: number;
  type: string;
  referenceId?: string | null;
  createdAt: string;
}
