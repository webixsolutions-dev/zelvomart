"use client";
import "@/components/admin/catalog-pages.css";

import { useState } from "react";
import AdminRichTextEditor from "@/components/admin/AdminRichTextEditor";
import { AdminError, AdminLoading, useAdminData } from "@/components/admin/useAdminData";
import { clientApi } from "@/lib/client-api";
import { PRODUCT_TAB_DEFS, mergeGlobalProductTabs, type ProductTabCopy, type ProductTabKey } from "@/lib/product-tabs";

type TabContent = ProductTabCopy;

function ProductTabsEditor({ initial }: { initial: Record<ProductTabKey, TabContent> }) {
  const [titles, setTitles] = useState<Record<ProductTabKey, string>>({
    whyChoose: initial.whyChoose.title,
    shippingProcess: initial.shippingProcess.title,
    generalFaq: initial.generalFaq.title,
  });
  const [contents, setContents] = useState<Record<ProductTabKey, string>>({
    whyChoose: initial.whyChoose.content,
    shippingProcess: initial.shippingProcess.content,
    generalFaq: initial.generalFaq.content,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  async function save() {
    setBusy(true);
    setMessage("");
    setSaveError("");
    const tabs = {
      whyChoose: { title: titles.whyChoose, content: contents.whyChoose },
      shippingProcess: { title: titles.shippingProcess, content: contents.shippingProcess },
      generalFaq: { title: titles.generalFaq, content: contents.generalFaq },
    };
    try {
      await clientApi("/api/admin/product-tabs", { method: "PUT", body: JSON.stringify({ tabs }) }, true);
      setMessage("Global product tabs saved. Products without an override now show this text.");
    } catch (requestError) {
      setSaveError(requestError instanceof Error ? requestError.message : "Could not save the global tabs");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pd-global-tabs admin-catalog-page">
      <div className="admin-title">
        <div>
          <h1>Product tabs</h1>
          <p>This text is shown on every product. Open a product and use Product tabs to replace any section for that product only. Leave a section empty to hide it.</p>
          <p>
            Type <code>{"{free_delivery_over}"}</code> or <code>{"{delivery_fee}"}</code> to show the current delivery amounts from Settings → Delivery
            (for example Rs 7,500 and Rs 190); they update by themselves when you change the delivery setting.
          </p>
        </div>
        <button type="button" className="admin-btn admin-btn-primary" disabled={busy} onClick={() => void save()}>
          {busy ? "Saving..." : "Save global tabs"}
        </button>
      </div>
      {message ? <p className="pd-save-note">{message}</p> : null}
      {saveError ? <p className="pd-save-error">{saveError}</p> : null}
      <div className="pd-stack">
        {PRODUCT_TAB_DEFS.map((tab) => (
          <section className="pd-card" key={tab.key}>
            <div className="pd-card-head">
              <h2>{tab.title}</h2>
              <p>Shown on the product page unless that product overrides this section.</p>
            </div>
            <label className="pd-name">
              <span>Section title</span>
              <input value={titles[tab.key]} onChange={(event) => setTitles((current) => ({ ...current, [tab.key]: event.target.value }))} />
            </label>
            <AdminRichTextEditor
              name={`global-${tab.key}`}
              defaultValue={initial[tab.key].content}
              onChange={(value) => setContents((current) => ({ ...current, [tab.key]: value }))}
              placeholder={`Write the global ${tab.title} section`}
            />
          </section>
        ))}
      </div>
    </div>
  );
}

export default function ProductTabsAdminPage() {
  const { data, loading, error } = useAdminData<{ tabs: Record<string, TabContent> | null }>("/api/admin/product-tabs", { tabs: null });
  if (loading) return <AdminLoading />;
  if (error) return <AdminError message={error} />;
  return <ProductTabsEditor key={JSON.stringify(data.tabs || {})} initial={mergeGlobalProductTabs(data.tabs)} />;
}
