import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ProductStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit, requireAdmin } from "@/lib/admin";
import { getSetting } from "@/lib/settings";
import AdminModal from "@/components/admin/AdminModal";
import AdminRichTextEditor from "@/components/admin/AdminRichTextEditor";

export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("products.write");
  const { id } = await params;
  const [product, categories, minPrice] = await Promise.all([
    prisma.product.findUnique({ where: { id }, include: { variants: true } }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    getSetting<number>("store.minimumSellingPrice", 1000),
  ]);
  if (!product) notFound();

  async function save(formData: FormData) {
    "use server";
    const user = await requireAdmin("products.write");
    const productId = String(formData.get("id"));
    const price = Number(formData.get("price") || 0);
    const saleRaw = String(formData.get("salePrice") || "").trim();
    const salePrice = saleRaw ? Number(saleRaw) : null;
    const bundleEnabled = formData.get("bundleEnabled") === "on";
    const bundleRaw = String(formData.get("bundleDiscountPercent") || "").trim();
    const bundleDiscount = bundleRaw ? Number(bundleRaw) : await getSetting<number>("store.bundleDefaultDiscountPercent", 5);
    const effective = salePrice ?? price;
    if (price < minPrice || (salePrice !== null && salePrice < minPrice) || (bundleEnabled && effective * (1 - bundleDiscount / 100) < minPrice)) throw new Error(`Selling price, including bundle per-piece price, must be at least Rs ${minPrice}`);
    const images = String(formData.get("images") || "").split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean);
    await prisma.product.update({
      where: { id: productId },
      data: {
        title: String(formData.get("title") || ""),
        slug: String(formData.get("slug") || ""),
        sku: String(formData.get("sku") || ""),
        shortDescription: String(formData.get("shortDescription") || "") || null,
        descriptionHtml: String(formData.get("descriptionHtml") || "") || null,
        images,
        videoUrl: String(formData.get("videoUrl") || "") || null,
        categoryId: String(formData.get("categoryId") || "") || null,
        price,
        salePrice,
        costPrice: String(formData.get("costPrice") || "") ? Number(formData.get("costPrice")) : null,
        stock: Number(formData.get("stock") || 0),
        status: String(formData.get("status")) as ProductStatus,
        featured: formData.get("featured") === "on",
        bundleEnabled,
        bundleDiscountPercent: bundleRaw ? Number(bundleRaw) : null,
        seoTitle: String(formData.get("seoTitle") || "") || null,
        seoDescription: String(formData.get("seoDescription") || "") || null,
      },
    });
    await audit(user.id, "update", "Product", productId);
    revalidatePath(`/admin/products/${productId}`);
    revalidatePath("/admin/products");
    revalidatePath(`/product/${product.slug}/`);
  }

  async function addVariant(formData: FormData) {
    "use server";
    const user = await requireAdmin("products.write");
    const productId = String(formData.get("productId"));
    const priceOverride = String(formData.get("priceOverride") || "").trim();
    if (priceOverride && Number(priceOverride) < minPrice) throw new Error(`Variant selling price must be at least Rs ${minPrice}`);
    const row = await prisma.variant.create({ data: { productId, sku: String(formData.get("sku") || ""), name: String(formData.get("name") || ""), attributes: { label: String(formData.get("name") || "") }, priceOverride: priceOverride ? Number(priceOverride) : null, stock: Number(formData.get("stock") || 0), imageUrl: String(formData.get("imageUrl") || "") || null } });
    await audit(user.id, "create", "Variant", row.id, { productId });
    revalidatePath(`/admin/products/${productId}`);
  }

  async function deleteVariant(formData: FormData) {
    "use server";
    const user = await requireAdmin("products.write");
    const variantId = String(formData.get("variantId"));
    await prisma.variant.delete({ where: { id: variantId } });
    await audit(user.id, "delete", "Variant", variantId);
    revalidatePath(`/admin/products/${id}`);
  }

  const imageText = Array.isArray(product.images) ? product.images.filter((value) => typeof value === "string").join("\n") : "";

  return (
    <>
      <div className="admin-title">
        <div><h1>Edit Product</h1><p>{product.title} • {product.sku}</p></div>
        <div className="admin-head-actions"><a className="admin-btn admin-btn-light" href="/admin/products">Back to Products</a><a className="admin-btn admin-btn-light" href={`/product/${product.slug}/`} target="_blank">View Storefront ↗</a></div>
      </div>

      <form action={save} className="admin-product-form">
        <input type="hidden" name="id" value={product.id} />
        <div className="admin-product-form-grid">
          <div className="admin-product-main">
            <section className="admin-form-section">
              <div className="admin-form-section-head"><h3>Basics</h3><p>Core product identity and catalog placement.</p></div>
              <div className="admin-reference-form">
                <label className="field"><span>Title *</span><input name="title" defaultValue={product.title} required /></label>
                <label className="field"><span>Slug *</span><input name="slug" defaultValue={product.slug} required /></label>
                <label className="field"><span>SKU *</span><input name="sku" defaultValue={product.sku} required /></label>
                <label className="field"><span>Category</span><select name="categoryId" defaultValue={product.categoryId || ""}><option value="">No category</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
              </div>
            </section>

            <section className="admin-form-section">
              <div className="admin-form-section-head"><h3>Pricing & Stock</h3><p>LaptopSouq-style grouped pricing and inventory controls.</p></div>
              <div className="admin-reference-form">
                <label className="field"><span>Regular price *</span><input type="number" min={minPrice} name="price" defaultValue={String(product.price)} required /></label>
                <label className="field"><span>Sale price</span><input type="number" min={minPrice} name="salePrice" defaultValue={product.salePrice ? String(product.salePrice) : ""} /></label>
                <label className="field"><span>Cost price (admin only)</span><input type="number" min="0" name="costPrice" defaultValue={product.costPrice ? String(product.costPrice) : ""} /></label>
                <label className="field"><span>Stock</span><input type="number" min="0" name="stock" defaultValue={product.stock} /></label>
              </div>
            </section>

            <section className="admin-form-section">
              <div className="admin-form-section-head"><h3>Short Description</h3><p>Compact highlights displayed around the product buying area.</p></div>
              <label className="field"><textarea name="shortDescription" rows={5} defaultValue={product.shortDescription || ""} /></label>
            </section>

            <section className="admin-form-section">
              <div className="admin-form-section-head"><h3>Main Description</h3><p>Full product description. HTML is preserved for migrated storefront content.</p></div>
              <AdminRichTextEditor name="descriptionHtml" defaultValue={product.descriptionHtml || ""} />
            </section>

            <section className="admin-form-section">
              <div className="admin-form-section-head"><h3>Images</h3><p>Gallery image URLs, one per line. First image is the primary product image.</p></div>
              <label className="field"><textarea name="images" rows={7} defaultValue={imageText} /></label>
              <label className="field mt-3"><span>Product video embed URL</span><input name="videoUrl" defaultValue={product.videoUrl || ""} placeholder="https://www.youtube.com/embed/..." /></label>
            </section>

            <section className="admin-form-section">
              <div className="admin-form-section-head admin-form-section-head-row"><div><h3>Variants</h3><p>Colour or option-level SKU, stock and image overrides.</p></div><AdminModal trigger={<><span>＋</span> Add Variant</>} title="Add Variant" description={`Add an option to ${product.title}.`} size="md" triggerClassName="admin-btn admin-btn-light"><form action={addVariant} className="admin-reference-shell"><input type="hidden" name="productId" value={product.id} /><div className="admin-reference-form"><label className="field"><span>Option name</span><input name="name" placeholder="Black" required /></label><label className="field"><span>Variant SKU</span><input name="sku" placeholder="ZM-001-BLK" required /></label><label className="field"><span>Price override</span><input name="priceOverride" type="number" min={minPrice} /></label><label className="field"><span>Stock</span><input name="stock" type="number" min="0" defaultValue="0" /></label><label className="field full"><span>Variant image URL</span><input name="imageUrl" placeholder="https://..." /></label></div><div className="admin-modal-footer-actions"><button className="admin-btn admin-btn-primary">Add Variant</button></div></form></AdminModal></div>
              <div className="admin-variant-list">
                {product.variants.map((variant) => <div className="admin-variant-row" key={variant.id}><div><b>{variant.name}</b><small>{variant.sku} • Stock {variant.stock} • {variant.priceOverride ? `PKR ${variant.priceOverride}` : "uses product price"}</small></div><form action={deleteVariant}><input type="hidden" name="variantId" value={variant.id} /><button className="admin-row-action admin-row-action-danger">Delete</button></form></div>)}
                {!product.variants.length ? <div className="admin-empty-inline">No variants added.</div> : null}
              </div>
            </section>
          </div>

          <aside className="admin-product-sidebar">
            <section className="admin-form-section admin-sticky-section">
              <div className="admin-form-section-head"><h3>Publish</h3><p>Visibility, merchandising and bundle controls.</p></div>
              <label className="field"><span>Status</span><select name="status" defaultValue={product.status}>{Object.values(ProductStatus).map((status) => <option key={status}>{status}</option>)}</select></label>
              <label className="admin-check"><input type="checkbox" name="featured" defaultChecked={product.featured} /> Featured product</label>
              <label className="admin-check"><input type="checkbox" name="bundleEnabled" defaultChecked={product.bundleEnabled} /> Enable Buy 2 bundle</label>
              <label className="field"><span>Bundle discount % override</span><input type="number" min="0" max="90" step="0.1" name="bundleDiscountPercent" defaultValue={product.bundleDiscountPercent ? String(product.bundleDiscountPercent) : ""} /></label>
            </section>

            <section className="admin-form-section">
              <div className="admin-form-section-head"><h3>SEO</h3><p>Search metadata for the product page.</p></div>
              <label className="field"><span>SEO title</span><input name="seoTitle" defaultValue={product.seoTitle || ""} /></label>
              <label className="field"><span>SEO description</span><textarea name="seoDescription" rows={6} defaultValue={product.seoDescription || ""} /></label>
            </section>
          </aside>
        </div>

        <div className="admin-product-savebar"><span>Changes affect the live product after publishing.</span><button className="admin-btn admin-btn-primary">Save Product</button></div>
      </form>
    </>
  );
}
