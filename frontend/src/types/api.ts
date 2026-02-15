/**
 * API types for the Asset Management System
 */

export interface ApiError {
  code: string;
  message: string;
  details?: ValidationError[];
  requestId: string;
  timestamp: string;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ApiResponse<T> {
  data: T;
  meta?: ResponseMeta;
}

export interface ResponseMeta {
  requestId: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationInfo;
  meta?: ResponseMeta;
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterParams {
  search?: string;
  status?: string[];
  type?: string[];
  dateFrom?: string;
  dateTo?: string;
}

export type RequestStatus = 'idle' | 'loading' | 'success' | 'error';

export interface RequestState<T> {
  status: RequestStatus;
  data: T | null;
  error: ApiError | null;
}
