import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can, type Permission } from "@/lib/permissions";
import { prisma } from "@/lib/db";

export async function requireAdmin(permission?: Permission) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  if (permission && !can(session.user.role, permission)) throw new Error("FORBIDDEN");
  return session.user;
}

export async function audit(userId: string, action: string, entity: string, entityId?: string, details?: unknown) {
  await prisma.auditLog.create({ data: { userId, action, entity, entityId, details: details as any } });
}
