import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit, requireAdmin } from "@/lib/admin";
import AdminModal from "@/components/admin/AdminModal";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function CategoryForm({ category }: { category?: { id:string; name:string; slug:string; sortOrder:number; imageUrl:string|null; description:string|null; seoTitle:string|null; seoDescription:string|null } }) {
  return (
    <div className="admin-reference-form">
      {category ? <input type="hidden" name="id" value={category.id} /> : null}
      <label className="field"><span>Name</span><input name="name" defaultValue={category?.name || ""} placeholder="Home & Living" required /></label>
      <label className="field"><span>Slug</span><input name="slug" defaultValue={category?.slug || ""} placeholder="home-living" /></label>
      <label className="field"><span>Sort order</span><input name="sortOrder" type="number" defaultValue={category?.sortOrder ?? 10} /></label>
      <label className="field"><span>Image URL</span><input name="imageUrl" defaultValue={category?.imageUrl || ""} placeholder="https://..." /></label>
      <label className="field full"><span>Description</span><textarea name="description" rows={5} defaultValue={category?.description || ""} /></label>
      <label className="field"><span>SEO title</span><input name="seoTitle" defaultValue={category?.seoTitle || ""} /></label>
      <label className="field"><span>SEO description</span><textarea name="seoDescription" rows={3} defaultValue={category?.seoDescription || ""} /></label>
    </div>
  );
}

export default async function CategoriesPage() {
  await requireAdmin("products.write");
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { products: true } } } });

  async function create(formData: FormData) {
    "use server";
    const user = await requireAdmin("products.write");
    const name = String(formData.get("name") || "").trim();
    if (!name) throw new Error("Category name is required");
    const row = await prisma.category.create({
      data: {
        name,
        slug: slugify(String(formData.get("slug") || name)),
        sortOrder: Number(formData.get("sortOrder") || 0),
        imageUrl: String(formData.get("imageUrl") || "") || null,
        description: String(formData.get("description") || "") || null,
        seoTitle: String(formData.get("seoTitle") || "") || null,
        seoDescription: String(formData.get("seoDescription") || "") || null,
      },
    });
    await audit(user.id, "create", "Category", row.id, { name });
    revalidatePath("/admin/categories");
  }

  async function save(formData: FormData) {
    "use server";
    const user = await requireAdmin("products.write");
    const id = String(formData.get("id"));
    await prisma.category.update({
      where: { id },
      data: {
        name: String(formData.get("name") || ""),
        slug: slugify(String(formData.get("slug") || formData.get("name") || "")),
        sortOrder: Number(formData.get("sortOrder") || 0),
        imageUrl: String(formData.get("imageUrl") || "") || null,
        description: String(formData.get("description") || "") || null,
        seoTitle: String(formData.get("seoTitle") || "") || null,
        seoDescription: String(formData.get("seoDescription") || "") || null,
      },
    });
    await audit(user.id, "update", "Category", id);
    revalidatePath("/admin/categories");
  }

  return (
    <>
      <div className="admin-title">
        <div><h1>Categories</h1><p>Create, order, image and SEO fields.</p></div>
        <AdminModal trigger={<><span className="text-base">＋</span> Add Category</>} title="Add Category" description="Create a storefront category and its SEO fields." size="lg">
          <form action={create} className="admin-reference-shell">
            <CategoryForm />
            <div className="admin-modal-footer-actions"><button className="admin-btn admin-btn-primary">Add Category</button></div>
          </form>
        </AdminModal>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Category</th><th>Slug</th><th>Sort</th><th>Products</th><th>Image</th><th>Action</th></tr></thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id}>
                <td><b>{category.name}</b><small className="admin-cell-sub">{category.description || "No description"}</small></td>
                <td>/{category.slug}/</td>
                <td>{category.sortOrder}</td>
                <td>{category._count.products}</td>
                <td>{category.imageUrl ? "Added" : "—"}</td>
                <td>
                  <AdminModal trigger="Edit" title={`Edit ${category.name}`} description="Update category content, image and SEO." size="lg" triggerClassName="admin-row-action">
                    <form action={save} className="admin-reference-shell">
                      <CategoryForm category={category} />
                      <div className="admin-modal-footer-actions"><button className="admin-btn admin-btn-primary">Save Category</button></div>
                    </form>
                  </AdminModal>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
