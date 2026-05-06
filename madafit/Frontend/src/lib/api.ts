import api from "@/services/api";
import type { User } from "@/types/entities";

export const API_URL = "/api";

export async function fetchUsers() {
  return api.users.getAll();
}

export async function deleteUser(id: number) {
  await api.users.delete(id);
}

export async function createUser(data: Partial<User>) {
  return api.users.create(data);
}

export async function fetchProducts() {
  return api.products.getAll();
}
