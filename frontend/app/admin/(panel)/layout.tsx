import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { signOut } from "@/auth";
import AdminNav from "@/components/admin/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const initials = (user.name || user.email || "A").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand-row">
          <Link href="/admin" className="admin-brand-mark">Z</Link>
          <Link href="/admin" className="admin-brand-copy"><b>ZELVOMART</b><span>ADMIN PORTAL</span></Link>
        </div>

        <AdminNav />

        <div className="admin-sidebar-foot">
          <div className="admin-profile-mini">
            <span className="admin-avatar">{initials}</span>
            <div><b>{user.name || "Admin"}</b><small>{String(user.role).replace(/_/g, " ")}</small></div>
          </div>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/admin/login" }); }}>
            <button className="admin-signout">Sign out</button>
          </form>
        </div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <div><span className="admin-topbar-kicker">Zelvomart</span><b>Store Management</b></div>
          <div className="admin-topbar-actions">
            <Link href="/" className="admin-view-store">View Store ↗</Link>
            <span className="admin-avatar">{initials}</span>
          </div>
        </header>
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}
