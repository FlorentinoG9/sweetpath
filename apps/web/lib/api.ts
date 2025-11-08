import { getApiBaseUrl } from "./config";

export interface House {
  id: number;
  name: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  treats_description: string | null;
  start_time: string | null;
  end_time: string | null;
  is_active: boolean;
  latitude: number;
  longitude: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface HousePayload {
  name: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state: string;
  postal_code: string;
  treats_description?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  is_active?: boolean;
  latitude?: number | null;
  longitude?: number | null;
}

class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function resolveUrl(path: string, search?: Record<string, string | number | boolean>) {
  const base = getApiBaseUrl();
  const url = new URL(path, base);
  if (search) {
    Object.entries(search).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
}

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const parsedResponse = response.clone();

  if (!response.ok) {
    let payload: unknown;
    try {
      payload = await parsedResponse.json();
    } catch {
      payload = await parsedResponse.text();
    }
    throw new ApiError(
      (payload as { detail?: string })?.detail ?? "Request failed.",
      response.status,
      payload,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return parsedResponse.json() as Promise<T>;
}

export async function fetchHouses(includeInactive = true): Promise<House[]> {
  const url = resolveUrl("houses", { include_inactive: includeInactive });
  return request<House[]>(url);
}

export async function createHouse(payload: HousePayload): Promise<House> {
  const url = resolveUrl("houses");
  return request<House>(url, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateHouse(id: number, payload: HousePayload): Promise<House> {
  const url = resolveUrl(`houses/${id}`);
  return request<House>(url, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteHouse(id: number): Promise<void> {
  const url = resolveUrl(`houses/${id}`);
  await request<void>(url, { method: "DELETE" });
}

export { ApiError };


