import { apiRequest } from './client';
import type { MessageResponse } from './types';

export type Vehicle = {
  id: number;
  vehicle_make: string;
  vehicle_model: string;
  license_plate: string;
  formatted_plate: string;
  nickname: string | null;
  default_park_time: number | null;
  is_default: boolean;
};

export type CreateVehicleInput = {
  vehicle_make: string;
  vehicle_model: string;
  license_plate: string;
  nickname?: string | null;
  default_park_time?: number | null;
};

export type UpdateVehicleInput = {
  vehicle_make: string;
  vehicle_model: string;
  license_plate: string;
  nickname?: string | null;
  default_park_time?: number | null;
};

type VehicleResponse = {
  data: Vehicle;
};

type VehicleListResponse = {
  data: Vehicle[];
};

export async function listVehicles(): Promise<Vehicle[]> {
  const response = await apiRequest<VehicleListResponse>('/vehicles', {
    method: 'GET',
    auth: true,
  });
  return response.data;
}

export async function createVehicle(body: CreateVehicleInput): Promise<Vehicle> {
  const response = await apiRequest<VehicleResponse>('/vehicles', {
    method: 'POST',
    body,
    auth: true,
  });
  return response.data;
}

export async function updateVehicle(
  id: number,
  body: UpdateVehicleInput,
): Promise<Vehicle> {
  const response = await apiRequest<VehicleResponse>(`/vehicles/${id}`, {
    method: 'PATCH',
    body,
    auth: true,
  });
  return response.data;
}

export async function deleteVehicle(id: number): Promise<void> {
  await apiRequest<MessageResponse>(`/vehicles/${id}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function setDefaultVehicle(id: number): Promise<Vehicle> {
  const response = await apiRequest<VehicleResponse>(`/vehicles/${id}/default`, {
    method: 'POST',
    auth: true,
  });
  return response.data;
}
