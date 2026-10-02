"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import AdminRichTextEditor from "./AdminRichTextEditor";
import { clientApi } from "@/lib/client-api";

type Category = { id: string; name: string };

type ProductFormProps = {
  categories: Category[];
  initial?: any;
  onSaved?: (product?: any) => void;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="admin-form-section admin-ls-section">
      <div className="admin-form-section-head">
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="admin-ls-section-body">{children}</div>
    </section>
  );
}

export default function ProductForm({ categories, initial, onSaved }: ProductFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const initialImages = useMemo<string[]>(
    () => (initial?.rawImages || initial?.images?.map((image: any) => (typeof image === "string" ? image : image?.src)) || []).filter(Boolean),
    [initial],
  );

  const [title, setTitle] = useState(initial?.title || initial?.name || "");
  const [slug, setSlug] = useState(initial?.slug || "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [status, setStatus] = useState(initial?.status || "DRAFT");
  const [images, setImages] = useState<string[]>(initialImages.slice(0, 5));
  const [manualImage, setManualImage] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [focusKeyword, setFocusKeyword] = useState(initial?.focusKeyword || "");
  const [seoTitle, setSeoTitle] = useState(initial?.seoTitle || "");
  const [seoDescription, setSeoDescription] = useState(initial?.seoDescription || "");

  const publishedSlugLocked = Boolean(initial && initial.status === "PUBLISHED");
  const seoPreviewTitle = seoTitle.trim() || title.trim() || "Product title";
  const seoPreviewDescription = seoDescription.trim() || "Add a meta description to control how this product appears in search results.";
  const normalizedKeyword = focusKeyword.trim().toLowerCase();
  const seoChecks = useMemo(() => {
    const effectiveTitle = seoPreviewTitle.toLowerCase();
    const description = seoDescription.trim();
    const normalizedSlug = slug.toLowerCase();
    const checks = [
      seoPreviewTitle.trim().length > 0 && seoPreviewTitle.trim().length <= 60,
      description.length >= 70 && description.length <= 160,
      normalizedKeyword.length >= 2,
      Boolean(normalizedKeyword && effectiveTitle.includes(normalizedKeyword)),
      Boolean(normalizedKeyword && description.toLowerCase().includes(normalizedKeyword)),
      Boolean(normalizedKeyword && normalizedSlug.includes(slugify(normalizedKeyword))),
      title.trim().length >= 20,
      images.length > 0,
      Boolean(slug.trim()),
    ];
    const passed = checks.filter(Boolean).length;
    return { passed, total: checks.length, score: Math.round((passed / checks.length) * 100) };
  }, [seoPreviewTitle, seoDescription, normalizedKeyword, slug, title, images.length]);

  const seoStatus = seoChecks.score >= 80 ? "Great" : seoChecks.score >= 60 ? "Good" : "Needs Work";

  function onTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched && !publishedSlugLocked) setSlug(slugify(value));
  }

  async function saveForm(targetStatus?: "DRAFT" | "PUBLISHED") {
    const form = formRef.current;
    if (!form || busy) return;
    if (!form.reportValidity()) return;

    setBusy(true);
    setError("");
    setSavedMessage("");
    const formData = new FormData(form);
    const nextStatus = targetStatus || status;
    const payload: any = {
      title: title.trim(),
      slug: slug.trim(),
      sku: String(formData.get("sku") || "").trim(),
      categoryId: formData.get("categoryId") || null,
      price: Number(formData.get("price") || 0),
      salePrice: formData.get("salePrice") || null,
      costPrice: formData.get("costPrice") || null,
      stock: Number(formData.get("stock") || 0),
      status: nextStatus,
      featured: formData.get("featured") === "on",
      bundleEnabled: formData.get("bundleEnabled") === "on",
      bundleDiscountPercent: formData.get("bundleDiscountPercent") || null,
      shortDescription: formData.get("shortDescription") || null,
      descriptionHtml: formData.get("descriptionHtml") || null,
      images,
      videoUrl: formData.get("videoUrl") || null,
      seoTitle: formData.get("seoTitle") || null,
      seoDescription: formData.get("seoDescription") || null,
      canonicalUrl: formData.get("canonicalUrl") || null,
      focusKeyword: focusKeyword.trim() || null,
    };

    try {
      const product = await clientApi<any>(
        initial ? `/api/admin/products/${initial.id}` : "/api/admin/products",
        { method: initial ? "PATCH" : "POST", body: JSON.stringify(payload) },
        true,
      );
      setStatus(nextStatus);
      setSavedMessage(nextStatus === "PUBLISHED" ? "Product published successfully." : "Draft saved successfully.");
      onSaved?.(product);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveForm();
  }

  async function uploadImages(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith("image/"));
    event.target.value = "";
    if (!files.length) return;
    const available = Math.max(0, 5 - images.length);
    if (!available) {
      setError("Maximum 5 product images are allowed.");
      return;
    }

    setUploadBusy(true);
    setError("");
    try {
      const uploaded: string[] = [];
      for (const file of files.slice(0, available)) {
        const data = new FormData();
        data.append("file", file);
        const response = await clientApi<{ url: string }>("/api/admin/upload", { method: "POST", body: data }, true);
        if (response.url) uploaded.push(response.url);
      }
      setImages((current) => Array.from(new Set([...current, ...uploaded])).slice(0, 5));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Image upload failed");
    } finally {
      setUploadBusy(false);
    }
  }

  function addManualImage() {
    const value = manualImage.trim();
    if (!value || images.length >= 5) return;
    setImages((current) => Array.from(new Set([...current, value])).slice(0, 5));
    setManualImage("");
  }

  return (
    <form ref={formRef} className="admin-product-form admin-product-form-reference admin-ls-product-form" onSubmit={submit}>
      <div className="admin-product-form-intro">
        <div>
          <h2>{initial ? "Edit Product" : "Add Product"}</h2>
          <p>{initial ? "Update product details, pricing, media and SEO." : "Create a new Zelvomart product using the same compact two-column workflow."}</p>
        </div>
      </div>

      <div className="admin-product-form-grid admin-product-form-grid-reference">
        <div className="admin-product-main">
          <SectionCard title="Basics" description="Core product information shown across the storefront and catalog.">
            <div className="admin-reference-form admin-ls-form-grid">
              <label className="field full">
                <span>Product Title <em>*</em></span>
                <input value={title} onChange={(event) => onTitleChange(event.target.value)} placeholder="e.g. Emelie Matte Liquid Lipgloss" required />
              </label>
              <label className="field">
                <span>Slug {publishedSlugLocked ? <small className="admin-locked-label">Locked</small> : null}</span>
                <input
                  value={slug}
                  readOnly={publishedSlugLocked}
                  onChange={(event) => {
                    setSlugTouched(true);
                    setSlug(slugify(event.target.value));
                  }}
                  placeholder="auto-generated-from-title"
                  required
                />
                <small>{publishedSlugLocked ? "Published slug is locked to protect SEO." : "Auto-fills from the title until you edit it."}</small>
              </label>
              <label className="field">
                <span>SKU <em>*</em></span>
                <input name="sku" defaultValue={initial?.sku || ""} placeholder="ZVM-0001" required />
              </label>
            </div>
          </SectionCard>

          <SectionCard title="Product Category" description="Choose the primary Zelvomart category for this item.">
            <label className="field">
              <span>Category</span>
              <select name="categoryId" defaultValue={initial?.categoryId || initial?.category?.id || ""}>
                <option value="">Uncategorized</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
          </SectionCard>

          <SectionCard title="Short Description" description="Keep this concise. It appears near the product price and buying actions.">
            <label className="field">
              <textarea name="shortDescription" rows={5} defaultValue={initial?.shortDescription || ""} placeholder="Key benefit, use case and important product detail..." />
            </label>
          </SectionCard>

          <SectionCard title="Main Description" description="Use headings, lists and links to create a complete product description.">
            <div className="field">
              <AdminRichTextEditor name="descriptionHtml" defaultValue={initial?.descriptionHtml || initial?.description || ""} />
            </div>
          </SectionCard>

          <SectionCard title="Pricing & Stock" description="Set selling price, optional sale/cost price and available stock.">
            <div className="admin-reference-form admin-ls-pricing-grid">
              <label className="field"><span>Regular Price (PKR) <em>*</em></span><input name="price" type="number" min="0" step="0.01" defaultValue={initial?.regularPrice ?? initial?.price ?? ""} required /></label>
              <label className="field"><span>Sale Price (PKR)</span><input name="salePrice" type="number" min="0" step="0.01" defaultValue={initial?.salePrice ?? ""} /></label>
              <label className="field"><span>Cost Price (PKR)</span><input name="costPrice" type="number" min="0" step="0.01" defaultValue={initial?.costPrice ?? ""} /></label>
              <label className="field"><span>Stock <em>*</em></span><input name="stock" type="number" min="0" defaultValue={initial?.stock ?? initial?.stockQuantity ?? 0} required /></label>
            </div>
          </SectionCard>

          <SectionCard title="Storefront Options" description="Control featured placement and the optional buy-2 offer.">
            <div className="admin-reference-form admin-ls-form-grid">
              <label className="admin-check"><input type="checkbox" name="featured" defaultChecked={Boolean(initial?.featured)} /> Featured product</label>
              <label className="admin-check"><input type="checkbox" name="bundleEnabled" defaultChecked={initial?.bundleEnabled !== false} /> Enable buy-2 bundle</label>
              <label className="field"><span>Bundle discount %</span><input name="bundleDiscountPercent" type="number" min="0" max="99" step="0.01" defaultValue={initial?.bundleDiscountPercent ?? 5} /></label>
            </div>
          </SectionCard>

          <SectionCard title="Images & Media" description="Add up to 5 product images. The first image becomes the main product image.">
            <div className="admin-form-section-head-row admin-media-actions">
              <div />
              <button type="button" className="admin-btn admin-btn-light" disabled={uploadBusy || images.length >= 5} onClick={() => fileRef.current?.click()}>
                {uploadBusy ? "Uploading..." : "Upload Images"}
              </button>
            </div>
            <input ref={fileRef} hidden type="file" accept="image/*" multiple onChange={uploadImages} />

            <div className="admin-product-image-grid">
              {images.map((src, index) => (
                <div className="admin-product-image-card" key={`${src}-${index}`}>
                  <div className="admin-product-image-preview"><img src={src} alt="" /></div>
                  <div className="admin-product-image-card-copy">
                    <b>{index === 0 ? "Main image" : `Gallery image ${index + 1}`}</b>
                    <small title={src}>{src}</small>
                  </div>
                  <button type="button" aria-label={`Remove image ${index + 1}`} onClick={() => setImages((current) => current.filter((_, imageIndex) => imageIndex !== index))}>×</button>
                </div>
              ))}
              {!images.length ? <div className="admin-product-image-empty">No images yet. Upload product images or add an image URL below.</div> : null}
            </div>

            <div className="admin-manual-image-row">
              <input value={manualImage} onChange={(event) => setManualImage(event.target.value)} placeholder="Or paste an image URL..." />
              <button type="button" className="admin-btn admin-btn-light" onClick={addManualImage} disabled={!manualImage.trim() || images.length >= 5}>Add URL</button>
            </div>
            <label className="field"><span>Product Video URL</span><input name="videoUrl" defaultValue={initial?.videoUrl || ""} placeholder="https://..." /></label>
          </SectionCard>
        </div>

        <aside className="admin-product-sidebar admin-product-sidebar-reference">
          <section className="admin-form-section admin-ls-section admin-seo-card admin-seo-panel admin-sticky-section">
            <div className="admin-seo-panel-head">
              <h3>SEO Panel</h3>
              <span>{seoChecks.passed}/{seoChecks.total} checks</span>
            </div>

            <div className="admin-seo-score-row">
              <div className="admin-seo-score-ring" style={{ background: `conic-gradient(#0aa7d8 ${seoChecks.score * 3.6}deg, #e5eaee 0deg)` }}>
                <div>{seoChecks.score}</div>
              </div>
              <div className="admin-seo-score-copy">
                <strong>{seoStatus}</strong>
                <span>SEO score / 100</span>
              </div>
            </div>

            <label className="field admin-seo-field">
              <span>Focus Keyword <small>{focusKeyword.length}/100</small></span>
              <input value={focusKeyword} maxLength={100} onChange={(event) => setFocusKeyword(event.target.value)} placeholder="e.g. matte liquid lipgloss" />
            </label>

            <label className="field admin-seo-field">
              <span>SEO Title <small className={seoTitle.length > 60 ? "over" : ""}>{seoTitle.length}/60</small></span>
              <input name="seoTitle" value={seoTitle} maxLength={70} onChange={(event) => setSeoTitle(event.target.value)} placeholder="Meta title shown in search results" />
            </label>

            <label className="field admin-seo-field">
              <span>Meta Description <small className={seoDescription.length > 160 ? "over" : ""}>{seoDescription.length}/160</small></span>
              <textarea name="seoDescription" rows={4} value={seoDescription} maxLength={180} onChange={(event) => setSeoDescription(event.target.value)} placeholder="Meta description shown in search results" />
            </label>

            <div className="admin-search-preview">
              <span>Search Preview</span>
              <div className="admin-search-preview-card">
                <small>https://zelvomart.com/product/{slug || "product-slug"}</small>
                <strong>{seoPreviewTitle}</strong>
                <p>{seoPreviewDescription}</p>
              </div>
            </div>

            <details className="admin-seo-advanced">
              <summary>Advanced SEO</summary>
              <label className="field"><span>Canonical URL</span><input name="canonicalUrl" defaultValue={initial?.canonicalUrl || ""} placeholder="https://zelvomart.com/product/..." /></label>
            </details>
          </section>

          <section className="admin-form-section admin-ls-section admin-product-status-card">
            <div className="admin-form-section-head"><h3>Status</h3></div>
            <label className="field"><span>Product Status</span><select name="status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option></select></label>
            <p className="admin-status-note">{initial ? "Editing existing product" : "New product draft"} · <b>{status === "PUBLISHED" ? "Published" : status === "ARCHIVED" ? "Archived" : "Draft"}</b></p>
          </section>
        </aside>
      </div>

      {error ? <div className="admin-import-message error admin-product-form-message">{error.replace(/_/g, " ")}</div> : null}
      {savedMessage ? <div className="admin-import-message success admin-product-form-message">{savedMessage}</div> : null}

      <div className="admin-product-footer-actions">
        <button type="button" className="admin-btn admin-btn-light" onClick={() => window.history.back()}>Cancel</button>
        <div>
          <button type="button" className="admin-btn admin-btn-light admin-save-draft-btn" disabled={busy} onClick={() => saveForm("DRAFT")}>{busy ? "Saving..." : "Save Draft"}</button>
          <button type="button" className="admin-btn admin-btn-primary" disabled={busy} onClick={() => saveForm("PUBLISHED")}>{busy ? "Saving..." : "Publish"}</button>
        </div>
      </div>
    </form>
  );
}
