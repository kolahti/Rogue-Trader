import type { ShipConfig } from "../engine/types";

export class ShipApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ShipApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : `Request failed (${res.status})`;
    throw new ShipApiError(message, res.status);
  }
  return body as T;
}

export function createShip(): Promise<{ id: string; url: string }> {
  return request("/api/ships", { method: "POST" });
}

export function loadShip(id: string): Promise<ShipConfig> {
  return request(`/api/ships/${encodeURIComponent(id)}`);
}

export function saveShip(id: string, sheet: ShipConfig): Promise<{ id: string }> {
  return request(`/api/ships/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(sheet),
  });
}
