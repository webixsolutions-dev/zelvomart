import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit, requireAdmin } from "@/lib/admin";
import AdminModal from "@/components/admin/AdminModal";

export default async function ContentPage() {
  await requireAdmin("content.write");
  const pages = await prisma.page.findMany({ orderBy: { slug: "asc" } });

  async function save(formData: FormData) {
    "use server";
    const user = await requireAdmin("content.write");
    const id = String(formData.get("id"));
    await prisma.page.update({
      where: { id },
      data: {
        title: String(formData.get("title") || ""),
        bodyHtml: String(formData.get("bodyHtml") || ""),
        seoTitle: String(formData.get("seoTitle") || "") || null,
        seoDescription: String(formData.get("seoDescription") || "") || null,
        published: formData.get("published") === "on",
      },
    });
    await audit(user.id, "update", "Page", id);
    revalidatePath("/admin/content");
  }

  return (
    <>
      <div className="admin-title">
        <div><h1>Content</h1><p>Select a page to open its editor.</p></div>
      </div>

      <div className="admin-content-grid">
        {pages.map((page) => (
          <AdminModal
            key={page.id}
            trigger={<span className="admin-content-trigger-copy"><b>{page.title}</b><small>/{page.slug}/</small></span>}
            title={page.title}
            description={`Edit /${page.slug}/ content and SEO.`}
            size="xl"
            triggerClassName="admin-content-button"
          >
            <form action={save} className="admin-reference-shell">
              <input type="hidden" name="id" value={page.id} />
              <div className="admin-reference-form">
                <label className="field full"><span>Title</span><input name="title" defaultValue={page.title} /></label>
                <label className="field full"><span>Body HTML</span><textarea name="bodyHtml" rows={16} defaultValue={page.bodyHtml} /></label>
                <label className="field"><span>SEO title</span><input name="seoTitle" defaultValue={page.seoTitle || ""} /></label>
                <label className="field"><span>SEO description</span><textarea name="seoDescription" rows={4} defaultValue={page.seoDescription || ""} /></label>
                <label className="admin-check full"><input type="checkbox" name="published" defaultChecked={page.published} /> Published</label>
              </div>
              <div className="admin-modal-footer-actions"><button className="admin-btn admin-btn-primary">Save Page</button></div>
            </form>
          </AdminModal>
        ))}
      </div>
    </>
  );
}
