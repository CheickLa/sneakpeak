export interface SortOptions {
  [key: string]: 1 | -1;
}

export interface FilterOptions {
  [key: string]: unknown;
}

export interface FormattedAddress {
  street: string;
  city: string;
  state: string;
  country: string;
  zip: string;
  name?: string;
  phone?: string;
}

export interface FormattedAddressError {
  error: string;
}

export interface PaginatedResponse<T> {
  total: number;
  page: number;
  limit: number;
  items: T[];
}
