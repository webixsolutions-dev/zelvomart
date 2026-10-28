import { AdminLoading } from "@/components/admin/useAdminData";

export default function Loading() {
  return (
    <main className="admin-main" aria-live="polite">
      <AdminLoading />
    </main>
  );
}
