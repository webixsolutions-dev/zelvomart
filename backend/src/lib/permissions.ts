import type { Role } from "../generated/prisma/client";

export type Permission =
  | "orders.read"
  | "orders.write"
  | "orders.export"
  | "products.write"
  | "content.write"
  | "customers.read"
  | "customers.write"
  | "settings.write"
  | "users.write"
  | "replays.write"
  | "reports.read";

const permissions: Record<Role, Permission[]> = {
  OWNER: [
    "orders.read",
    "orders.write",
    "orders.export",
    "products.write",
    "content.write",
    "customers.read",
    "customers.write",
    "settings.write",
    "users.write",
    "replays.write",
    "reports.read",
  ],
  MANAGER: [
    "orders.read",
    "orders.write",
    "orders.export",
    "products.write",
    "content.write",
    "customers.read",
    "customers.write",
    "replays.write",
    "reports.read",
  ],
  ORDER_AGENT: ["orders.read", "orders.write", "customers.read", "customers.write"],
  MARKETER: ["products.write", "content.write", "reports.read"],
};

export function can(role: Role, permission: Permission) {
  return permissions[role].includes(permission);
}
