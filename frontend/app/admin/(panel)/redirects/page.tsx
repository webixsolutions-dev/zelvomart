import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit, requireAdmin } from "@/lib/admin";
import AdminModal from "@/components/admin/AdminModal";

export default async function RedirectsPage() {
  await requireAdmin("content.write");
  const redirects = await prisma.redirect.findMany({ orderBy: { sourcePath: "asc" } });

  async function save(formData: FormData) {
    "use server";
    const user = await requireAdmin("content.write");
    const rawSource = String(formData.get("sourcePath") || "").trim();
    const sourcePath = `/${rawSource.replace(/^\/+|\/+$/g, "")}/`;
    const destinationRaw = String(formData.get("destination") || "").trim();
    const destination = destinationRaw.startsWith("http") ? destinationRaw : `/${destinationRaw.replace(/^\/+|\/+$/g, "")}/`;
    const row = await prisma.redirect.upsert({ where: { sourcePath }, update: { destination, permanent: true }, create: { sourcePath, destination, permanent: true } });
    await audit(user.id, "upsert", "Redirect", row.id, { sourcePath, destination });
    revalidatePath("/admin/redirects");
  }

  async function remove(formData: FormData) {
    "use server";
    const user = await requireAdmin("content.write");
    const id = String(formData.get("id"));
    await prisma.redirect.delete({ where: { id } });
    await audit(user.id, "delete", "Redirect", id);
    revalidatePath("/admin/redirects");
  }

  return (
    <>
      <div className="admin-title">
        <div><h1>SEO Redirects</h1><p>Use only when a current WordPress URL cannot stay identical.</p></div>
        <AdminModal trigger={<><span className="text-base">＋</span> Add Redirect</>} title="Add 301 Redirect" description="Map an old URL to its permanent destination." size="md">
          <form action={save} className="admin-reference-shell">
            <div className="admin-reference-form">
              <label className="field"><span>Old URL / path</span><input name="sourcePath" placeholder="old-path" required /></label>
              <label className="field"><span>Destination</span><input name="destination" placeholder="new-path" required /></label>
            </div>
            <div className="admin-modal-footer-actions"><button className="admin-btn admin-btn-primary">Add 301</button></div>
          </form>
        </AdminModal>
      </div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Old URL</th><th>Destination</th><th>Action</th></tr></thead><tbody>{redirects.map((row) => <tr key={row.id}><td>{row.sourcePath}</td><td>{row.destination}</td><td><form action={remove}><input type="hidden" name="id" value={row.id}/><button className="admin-row-action admin-row-action-danger">Delete</button></form></td></tr>)}{!redirects.length ? <tr><td colSpan={3} className="admin-empty">No redirects. That is ideal when all existing URLs are preserved.</td></tr> : null}</tbody></table></div>
    </>
  );
}
