import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin, audit } from "@/lib/admin";
import AdminModal from "@/components/admin/AdminModal";

export default async function UsersPage() {
  await requireAdmin("users.write");
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  async function create(formData: FormData) {
    "use server";
    const owner = await requireAdmin("users.write");
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    const role = String(formData.get("role") || Role.MANAGER) as Role;
    const row = await prisma.user.create({
      data: {
        name: String(formData.get("name") || "").trim(),
        email,
        passwordHash: await bcrypt.hash(password, 12),
        role,
        totpSecret: null,
        twoFactorReady: false,
      },
    });
    await audit(owner.id, "create", "User", row.id, { role: row.role });
    revalidatePath("/admin/users");
  }

  async function toggle(formData: FormData) {
    "use server";
    const owner = await requireAdmin("users.write");
    const id = String(formData.get("id"));
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return;
    await prisma.user.update({ where: { id }, data: { active: !user.active } });
    await audit(owner.id, "toggle_active", "User", id, { active: !user.active });
    revalidatePath("/admin/users");
  }

  return (
    <>
      <div className="admin-title">
        <div><span className="admin-eyebrow">ACCESS</span><h1>Users & Roles</h1><p>Create staff accounts with simple email and password sign-in.</p></div>
        <AdminModal trigger={<><span className="text-base">＋</span> Add Staff User</>} title="Add Staff User" description="Create an admin account and assign the correct role." size="md">
          <form action={create} className="admin-reference-shell">
            <div className="admin-reference-form">
              <label className="field"><span>Name</span><input name="name" placeholder="Full name" required /></label>
              <label className="field"><span>Email</span><input name="email" type="email" placeholder="name@example.com" required /></label>
              <label className="field"><span>Password</span><input name="password" type="password" minLength={8} placeholder="Temporary password" required /></label>
              <label className="field"><span>Role</span><select name="role">{Object.values(Role).map((role) => <option key={role} value={role}>{role.replace(/_/g, " ")}</option>)}</select></label>
            </div>
            <div className="admin-modal-footer-actions"><button className="admin-btn admin-btn-primary">Create User</button></div>
          </form>
        </AdminModal>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>User</th><th>Role</th><th>Sign-in</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>{users.map((user) => (
            <tr key={user.id}>
              <td><b>{user.name}</b><small className="admin-cell-sub">{user.email}</small></td>
              <td><span className="status-pill">{user.role.replace(/_/g, " ")}</span></td>
              <td>Email + password</td>
              <td><span className={`status-pill ${user.active ? "status-delivered" : "status-cancelled"}`}>{user.active ? "Active" : "Disabled"}</span></td>
              <td><form action={toggle}><input type="hidden" name="id" value={user.id} /><button className="admin-row-action">{user.active ? "Disable" : "Enable"}</button></form></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}
