import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ProductStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit, requireAdmin } from "@/lib/admin";
import { getSetting } from "@/lib/settings";
import { money } from "@/lib/format";
import AdminModal from "@/components/admin/AdminModal";
import AdminRichTextEditor from "@/components/admin/AdminRichTextEditor";
import ProductAdminTools from "@/components/admin/ProductAdminTools";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; status?: string }> }) {
  await requireAdmin("products.write");
  const params = await searchParams;
  const q = String(params.q || "").trim();
  const categoryFilter = String(params.category || "").trim();
  const statusFilter = String(params.status || "").trim();
  const safeStatus = Object.values(ProductStatus).includes(statusFilter as ProductStatus) ? statusFilter as ProductStatus : undefined;

  const [products, categories, minPrice] = await Promise.all([
    prisma.product.findMany({
      where: {
        ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] } : {}),
        ...(categoryFilter ? { categoryId: categoryFilter } : {}),
        ...(safeStatus ? { status: safeStatus } : {}),
      },
      include: { category: true },
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    getSetting<number>("store.minimumSellingPrice", 1000),
  ]);

  async function createProduct(formData: FormData) {
    "use server";
    const user = await requireAdmin("products.write");
    const title = String(formData.get("title") || "").trim();
    const sku = String(formData.get("sku") || "").trim();
    const price = Number(formData.get("price") || 0);
    const saleRaw = String(formData.get("salePrice") || "").trim();
    const salePrice = saleRaw ? Number(saleRaw) : null;
    const bundleRaw = String(formData.get("bundleDiscountPercent") || "").trim();
    const bundleEnabled = formData.get("bundleEnabled") === "on";
    const bundleDiscount = bundleRaw ? Number(bundleRaw) : await getSetting<number>("store.bundleDefaultDiscountPercent", 5);
    const effectivePrice = salePrice ?? price;

    if (!title || !sku) throw new Error("Product title and SKU are required");
    if (price < minPrice || (salePrice !== null && salePrice < minPrice) || (bundleEnabled && effectivePrice * (1 - bundleDiscount / 100) < minPrice)) {
      throw new Error(`Selling price, including bundle per-piece price, must be at least Rs ${minPrice}`);
    }

    const images = String(formData.get("images") || "")
      .split(/\r?\n|,/)
      .map((value) => value.trim())
      .filter(Boolean);

    const row = await prisma.product.create({
      data: {
        title,
        slug: slugify(String(formData.get("slug") || title)),
        sku,
        categoryId: String(formData.get("categoryId") || "") || null,
        price,
        salePrice,
        costPrice: String(formData.get("costPrice") || "").trim() ? Number(formData.get("costPrice")) : null,
        stock: Number(formData.get("stock") || 0),
        status: String(formData.get("status") || ProductStatus.DRAFT) as ProductStatus,
        shortDescription: String(formData.get("shortDescription") || "") || null,
        descriptionHtml: String(formData.get("descriptionHtml") || "") || null,
        images,
        videoUrl: String(formData.get("videoUrl") || "") || null,
        featured: formData.get("featured") === "on",
        bundleEnabled,
        bundleDiscountPercent: bundleRaw ? Number(bundleRaw) : null,
        seoTitle: String(formData.get("seoTitle") || "") || null,
        seoDescription: String(formData.get("seoDescription") || "") || null,
      },
    });

    await audit(user.id, "create", "Product", row.id, { title, sku });
    revalidatePath("/admin/products");
  }

  async function saveProduct(formData: FormData) {
    "use server";
    const user = await requireAdmin("products.write");
    const id = String(formData.get("id"));
    const price = Number(formData.get("price") || 0);
    const saleRaw = String(formData.get("salePrice") || "").trim();
    const salePrice = saleRaw ? Number(saleRaw) : null;
    const bundleRaw = String(formData.get("bundleDiscountPercent") || "").trim();
    const bundleEnabled = formData.get("bundleEnabled") === "on";
    const bundleDiscount = bundleRaw ? Number(bundleRaw) : await getSetting<number>("store.bundleDefaultDiscountPercent", 5);
    const effective = salePrice ?? price;
    if (price < minPrice || (salePrice !== null && salePrice < minPrice) || (bundleEnabled && effective * (1 - bundleDiscount / 100) < minPrice)) {
      throw new Error(`Selling price, including bundle per-piece price, must be at least Rs ${minPrice}`);
    }
    const images = String(formData.get("images") || "").split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean);
    const current = await prisma.product.findUnique({ where: { id }, select: { slug: true } });
    await prisma.product.update({
      where: { id },
      data: {
        title: String(formData.get("title") || ""),
        slug: slugify(String(formData.get("slug") || formData.get("title") || "")),
        sku: String(formData.get("sku") || ""),
        categoryId: String(formData.get("categoryId") || "") || null,
        price, salePrice,
        costPrice: String(formData.get("costPrice") || "").trim() ? Number(formData.get("costPrice")) : null,
        stock: Number(formData.get("stock") || 0),
        status: String(formData.get("status") || ProductStatus.DRAFT) as ProductStatus,
        shortDescription: String(formData.get("shortDescription") || "") || null,
        descriptionHtml: String(formData.get("descriptionHtml") || "") || null,
        images,
        videoUrl: String(formData.get("videoUrl") || "") || null,
        featured: formData.get("featured") === "on",
        bundleEnabled,
        bundleDiscountPercent: bundleRaw ? Number(bundleRaw) : null,
        seoTitle: String(formData.get("seoTitle") || "") || null,
        seoDescription: String(formData.get("seoDescription") || "") || null,
      },
    });
    await audit(user.id, "update", "Product", id);
    revalidatePath("/admin/products");
    if (current?.slug) revalidatePath(`/product/${current.slug}/`);
  }

  return (
    <>
      <div className="admin-title admin-products-title">
        <div>
          <span className="admin-eyebrow">CATALOG</span>
          <h1>Products</h1>
          <p>Create, import, edit, publish, price, stock, bundle and SEO settings.</p>
        </div>
        <div className="admin-head-actions admin-products-actions">
          <ProductAdminTools />
          <AdminModal
          trigger={<><span className="text-base">＋</span> Add Product</>}
          title="Add Product"
          description="LaptopSouq-style product editor with catalog, content, pricing, media and SEO in one place."
          size="full"
        >
          <form action={createProduct} className="admin-product-form">
            <div className="admin-product-form-grid">
              <div className="admin-product-main">
                <section className="admin-form-section">
                  <div className="admin-form-section-head"><h3>Basics</h3><p>Core catalog information and category.</p></div>
                  <div className="admin-reference-form">
                    <label className="field"><span>Product title *</span><input name="title" placeholder="e.g. Premium Storage Organizer" required /></label>
                    <label className="field"><span>Slug</span><input name="slug" placeholder="auto-generated-from-title" /></label>
                    <label className="field"><span>SKU *</span><input name="sku" placeholder="ZM-001" required /></label>
                    <label className="field"><span>Category</span><select name="categoryId"><option value="">No category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                  </div>
                </section>

                <section className="admin-form-section">
                  <div className="admin-form-section-head"><h3>Pricing & Stock</h3><p>Customer price, internal cost and available inventory.</p></div>
                  <div className="admin-reference-form">
                    <label className="field"><span>Regular price *</span><input name="price" type="number" min={minPrice} placeholder={`Minimum Rs ${minPrice}`} required /></label>
                    <label className="field"><span>Sale price</span><input name="salePrice" type="number" min={minPrice} placeholder="Optional" /></label>
                    <label className="field"><span>Cost price (admin only)</span><input name="costPrice" type="number" min="0" placeholder="Optional" /></label>
                    <label className="field"><span>Stock *</span><input name="stock" type="number" min="0" defaultValue="0" required /></label>
                  </div>
                </section>

                <section className="admin-form-section">
                  <div className="admin-form-section-head"><h3>Short Description</h3><p>Compact product highlights shown near the buying controls.</p></div>
                  <label className="field"><textarea name="shortDescription" rows={4} placeholder="Key benefits, material, size, compatibility or other short highlights." /></label>
                </section>

                <section className="admin-form-section">
                  <div className="admin-form-section-head"><h3>Main Description</h3><p>Product description supports HTML so the existing storefront formatting can be preserved.</p></div>
                  <AdminRichTextEditor name="descriptionHtml" placeholder="Write or paste the full product description here..." />
                </section>

                <section className="admin-form-section">
                  <div className="admin-form-section-head"><h3>Images & Video</h3><p>Add gallery image URLs, one per line. The first image is used as the primary image.</p></div>
                  <label className="field"><span>Image URLs</span><textarea name="images" rows={6} placeholder="https://.../image-1.webp\nhttps://.../image-2.webp" /></label>
                  <label className="field mt-3"><span>Product video embed URL</span><input name="videoUrl" placeholder="https://www.youtube.com/embed/..." /></label>
                  <div className="admin-media-note">Image upload endpoint is already available for R2/S3. URL rows remain compatible with migrated WordPress images.</div>
                </section>
              </div>

              <aside className="admin-product-sidebar">
                <section className="admin-form-section">
                  <div className="admin-form-section-head"><h3>Publish</h3><p>Control catalog visibility and merchandising.</p></div>
                  <label className="field"><span>Status</span><select name="status" defaultValue={ProductStatus.DRAFT}>{Object.values(ProductStatus).map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
                  <label className="admin-check"><input type="checkbox" name="featured" /> Featured product</label>
                  <label className="admin-check"><input type="checkbox" name="bundleEnabled" defaultChecked /> Enable Buy 2 bundle</label>
                  <label className="field"><span>Bundle discount % override</span><input name="bundleDiscountPercent" type="number" min="0" max="90" step="0.1" placeholder="Use store default" /></label>
                </section>

                <section className="admin-form-section">
                  <div className="admin-form-section-head"><h3>SEO</h3><p>Search and social metadata for this product.</p></div>
                  <label className="field"><span>SEO title</span><input name="seoTitle" placeholder="SEO title" /></label>
                  <label className="field"><span>SEO description</span><textarea name="seoDescription" rows={5} placeholder="Meta description" /></label>
                </section>
              </aside>
            </div>
            <div className="admin-modal-footer-actions">
              <button className="admin-btn admin-btn-primary" type="submit">Create Product</button>
            </div>
          </form>
        </AdminModal>
        </div>
      </div>

      <div className="admin-product-toolbar-card">
        <form className="admin-product-toolbar" method="get">
          <label className="admin-product-search">
            <span>⌕</span>
            <input name="q" defaultValue={q} placeholder="Search by product name or SKU..." />
          </label>
          <select name="category" defaultValue={categoryFilter}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <select name="status" defaultValue={safeStatus || ""}>
            <option value="">All statuses</option>
            {Object.values(ProductStatus).map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <button className="admin-btn admin-btn-primary" type="submit">Filter</button>
          {(q || categoryFilter || safeStatus) ? <Link className="admin-btn admin-btn-light" href="/admin/products">Clear</Link> : null}
          <span className="admin-product-count">{products.length} shown</span>
        </form>
      </div>

      <div className="admin-table-wrap admin-products-table">
        <table className="admin-table">
          <thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td><div className="admin-product-cell">{Array.isArray(product.images) && typeof product.images[0] === "string" ? <img src={product.images[0]} alt="" /> : <span className="admin-product-thumb-placeholder">ZM</span>}<div><b>{product.title}</b><small>Updated {product.updatedAt.toLocaleDateString("en-GB")}</small></div></div></td>
                <td>{product.sku}</td>
                <td>{product.category?.name || "—"}</td>
                <td>{money(product.salePrice ?? product.price)}</td>
                <td>{product.stock}</td>
                <td><span className="status-pill">{product.status}</span></td>
                <td><AdminModal trigger="Edit" title={`Edit ${product.title}`} description="Update product catalog, content, pricing, media and SEO." size="full" triggerClassName="admin-row-action"><form action={saveProduct} className="admin-product-form"><input type="hidden" name="id" value={product.id}/><div className="admin-product-form-grid"><div className="admin-product-main"><section className="admin-form-section"><div className="admin-form-section-head"><h3>Basics</h3><p>Core product information.</p></div><div className="admin-reference-form"><label className="field"><span>Title</span><input name="title" defaultValue={product.title} required/></label><label className="field"><span>Slug</span><input name="slug" defaultValue={product.slug} required/></label><label className="field"><span>SKU</span><input name="sku" defaultValue={product.sku} required/></label><label className="field"><span>Category</span><select name="categoryId" defaultValue={product.categoryId||""}><option value="">No category</option>{categories.map((category)=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label></div></section><section className="admin-form-section"><div className="admin-form-section-head"><h3>Pricing & Stock</h3><p>Price and inventory controls.</p></div><div className="admin-reference-form"><label className="field"><span>Regular price</span><input name="price" type="number" min={minPrice} defaultValue={String(product.price)} required/></label><label className="field"><span>Sale price</span><input name="salePrice" type="number" min={minPrice} defaultValue={product.salePrice?String(product.salePrice):""}/></label><label className="field"><span>Cost price</span><input name="costPrice" type="number" min="0" defaultValue={product.costPrice?String(product.costPrice):""}/></label><label className="field"><span>Stock</span><input name="stock" type="number" min="0" defaultValue={product.stock}/></label></div></section><section className="admin-form-section"><div className="admin-form-section-head"><h3>Short Description</h3></div><label className="field"><textarea name="shortDescription" rows={5} defaultValue={product.shortDescription||""}/></label></section><section className="admin-form-section"><div className="admin-form-section-head"><h3>Main Description</h3><p>LaptopSouq-style formatted description editor.</p></div><AdminRichTextEditor name="descriptionHtml" defaultValue={product.descriptionHtml||""}/></section><section className="admin-form-section"><div className="admin-form-section-head"><h3>Images & Video</h3></div><label className="field"><span>Image URLs, one per line</span><textarea name="images" rows={6} defaultValue={Array.isArray(product.images)?product.images.filter((value)=>typeof value==="string").join("\n"):""}/></label><label className="field mt-3"><span>Video embed URL</span><input name="videoUrl" defaultValue={product.videoUrl||""}/></label></section></div><aside className="admin-product-sidebar"><section className="admin-form-section"><div className="admin-form-section-head"><h3>Publish</h3></div><label className="field"><span>Status</span><select name="status" defaultValue={product.status}>{Object.values(ProductStatus).map((status)=><option key={status}>{status}</option>)}</select></label><label className="admin-check"><input type="checkbox" name="featured" defaultChecked={product.featured}/> Featured product</label><label className="admin-check"><input type="checkbox" name="bundleEnabled" defaultChecked={product.bundleEnabled}/> Enable Buy 2 bundle</label><label className="field"><span>Bundle discount % override</span><input name="bundleDiscountPercent" type="number" min="0" max="90" step="0.1" defaultValue={product.bundleDiscountPercent?String(product.bundleDiscountPercent):""}/></label></section><section className="admin-form-section"><div className="admin-form-section-head"><h3>SEO</h3></div><label className="field"><span>SEO title</span><input name="seoTitle" defaultValue={product.seoTitle||""}/></label><label className="field"><span>SEO description</span><textarea name="seoDescription" rows={6} defaultValue={product.seoDescription||""}/></label><a className="admin-btn admin-btn-light mt-3" href={`/admin/products/${product.id}`}>Variants / Advanced</a></section></aside></div><div className="admin-modal-footer-actions"><button className="admin-btn admin-btn-primary">Save Product</button></div></form></AdminModal></td>
              </tr>
            ))}
            {!products.length ? <tr><td className="admin-empty" colSpan={7}>No products yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
