import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit, requireAdmin } from "@/lib/admin";
import { getSetting } from "@/lib/settings";
import AdminModal from "@/components/admin/AdminModal";

async function putSetting(key: string, value: unknown) {
  await prisma.setting.upsert({ where: { key }, update: { value: value as any }, create: { key, value: value as any } });
}

export default async function SettingsPage() {
  await requireAdmin("settings.write");
  const [info, announcement, delivery, required, bundle, minPrice, pixel, clarity, recipients, home, payments, teamTemplate, customerTemplate, cities] = await Promise.all([
    getSetting<any>("store.info", {}),
    getSetting<any>("store.announcement", { enabled: true, items: [] }),
    getSetting<any>("store.delivery", {}),
    getSetting<any>("checkout.requiredFields", {}),
    getSetting<number>("store.bundleDefaultDiscountPercent", 5),
    getSetting<number>("store.minimumSellingPrice", 1000),
    getSetting<string>("tracking.metaPixelId", "1645715973642563"),
    getSetting<string>("tracking.clarityId", ""),
    getSetting<string[]>("notifications.orderRecipients", ["zelvomart@gmail.com"]),
    getSetting<any>("homepage.config", {}),
    getSetting<string[]>("payments.methods", ["COD"]),
    getSetting<string>("notifications.teamOrderTemplate", ""),
    getSetting<string>("notifications.customerOrderTemplate", ""),
    prisma.city.findMany({ orderBy: { name: "asc" } }),
  ]);


  async function save(formData: FormData) {
    "use server";
    const user = await requireAdmin("settings.write");
    const section = String(formData.get("section") || "");
    const keys: string[] = [];

    if (section === "store") {
      await putSetting("store.info", { name: "Zelvomart", phone: String(formData.get("phone") || ""), email: String(formData.get("email") || ""), whatsapp: String(formData.get("whatsapp") || "").replace(/\D/g, ""), country: "Pakistan" });
      await putSetting("store.minimumSellingPrice", Number(formData.get("minPrice") || 1000));
      await putSetting("store.bundleDefaultDiscountPercent", Number(formData.get("bundleDiscount") || 5));
      keys.push("store.info", "store.minimumSellingPrice", "store.bundleDefaultDiscountPercent");
    }

    if (section === "announcement") {
      await putSetting("store.announcement", { enabled: formData.get("announcementEnabled") === "on", items: String(formData.get("announcementItems") || "").split(/\r?\n/).map((value) => value.trim()).filter(Boolean) });
      keys.push("store.announcement");
    }

    if (section === "delivery") {
      await putSetting("store.delivery", { mode: String(formData.get("deliveryMode") || "FREE"), flatRate: Number(formData.get("flatRate") || 0), freeAbove: Number(formData.get("freeAbove") || 0), codFee: Number(formData.get("codFee") || 0) });
      await putSetting("payments.methods", ["COD", ...(formData.get("nayaPay") === "on" ? ["NAYAPAY"] : [])]);
      keys.push("store.delivery", "payments.methods");
    }

    if (section === "checkout") {
      await putSetting("checkout.requiredFields", { fullName: true, phone: true, city: true, address: true, email: formData.get("reqEmail") === "on", postcode: formData.get("reqPostcode") === "on", terms: formData.get("reqTerms") === "on", orderNotes: false });
      keys.push("checkout.requiredFields");
    }

    if (section === "cities") {
      const cityLines = String(formData.get("cities") || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const names: string[] = [];
      for (const line of cityLines) {
        const [nameRaw, minRaw, maxRaw] = line.split("|").map((part) => part.trim());
        if (!nameRaw) continue;
        names.push(nameRaw);
        const min = Math.max(1, Number(minRaw || 2) || 2);
        const max = Math.max(min, Number(maxRaw || 5) || 5);
        await prisma.city.upsert({ where: { name: nameRaw }, update: { deliveryMinDays: min, deliveryMaxDays: max, active: true }, create: { name: nameRaw, deliveryMinDays: min, deliveryMaxDays: max, active: true } });
      }
      if (names.length) await prisma.city.updateMany({ where: { name: { notIn: names } }, data: { active: false } });
      keys.push("cities");
    }

    if (section === "tracking") {
      await putSetting("tracking.metaPixelId", String(formData.get("pixel") || ""));
      await putSetting("tracking.clarityId", String(formData.get("clarity") || ""));
      await putSetting("notifications.orderRecipients", String(formData.get("recipients") || "").split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean));
      await putSetting("notifications.teamOrderTemplate", String(formData.get("teamTemplate") || ""));
      await putSetting("notifications.customerOrderTemplate", String(formData.get("customerTemplate") || ""));
      keys.push("tracking.metaPixelId", "tracking.clarityId", "notifications.orderRecipients", "notifications.teamOrderTemplate", "notifications.customerOrderTemplate");
    }

    if (section === "homepage") {
      await putSetting("homepage.config", { ...home, heroKicker: String(formData.get("heroKicker") || ""), heroTitle: String(formData.get("heroTitle") || ""), heroBody: String(formData.get("heroBody") || ""), popularCollectionsVideos: (() => { try { return JSON.parse(String(formData.get("videos") || "[]")); } catch { return home.popularCollectionsVideos || []; } })() });
      keys.push("homepage.config");
    }

    await audit(user.id, "update", "Setting", undefined, { section, keys });
    revalidatePath("/");
    revalidatePath("/checkout");
    revalidatePath("/admin/settings");
  }

  const cards = [
    { key: "store", title: "Store", description: "Phone, email, WhatsApp, price floor and default bundle discount." },
    { key: "announcement", title: "Announcement Bar", description: "Control the moving storefront ticker and its messages." },
    { key: "delivery", title: "Delivery & Payments", description: "Delivery mode, free-delivery threshold, COD fee and payments." },
    { key: "checkout", title: "Checkout Fields", description: "Choose which guest checkout fields are required." },
    { key: "cities", title: "Cities & Estimates", description: "Manage Pakistani delivery cities and delivery day ranges." },
    { key: "tracking", title: "Tracking & Notifications", description: "Meta Pixel, Clarity, order recipients and email templates." },
    { key: "homepage", title: "Homepage", description: "Hero copy and popular collection video configuration." },
  ];

  return (
    <>
      <div className="admin-title"><div><h1>Settings</h1><p>Select a settings section to edit it in a popup.</p></div></div>
      <div className="admin-settings-grid">
        {cards.map((card) => (
          <div className="admin-settings-card" key={card.key}>
            <div><span className="admin-settings-icon">⚙</span><h2>{card.title}</h2><p>{card.description}</p></div>
            <AdminModal trigger="Open Settings" title={card.title} description={card.description} size={card.key === "tracking" || card.key === "cities" ? "xl" : "lg"} triggerClassName="admin-btn admin-btn-light">
              <form action={save} className="admin-reference-shell">
                <input type="hidden" name="section" value={card.key} />
                {card.key === "store" ? <div className="admin-reference-form">
                  <label className="field"><span>Phone</span><input name="phone" defaultValue={info.phone || "0300-2026711"} /></label>
                  <label className="field"><span>Email</span><input name="email" defaultValue={info.email || "zelvomart@gmail.com"} /></label>
                  <label className="field"><span>WhatsApp number</span><input name="whatsapp" defaultValue={info.whatsapp || "923002026711"} /></label>
                  <label className="field"><span>Minimum selling price</span><input type="number" name="minPrice" defaultValue={minPrice} /></label>
                  <label className="field"><span>Default Buy 2 discount %</span><input type="number" step="0.1" name="bundleDiscount" defaultValue={bundle} /></label>
                </div> : null}

                {card.key === "announcement" ? <div className="admin-reference-form"><label className="admin-check full"><input type="checkbox" name="announcementEnabled" defaultChecked={announcement.enabled} /> Enabled</label><label className="field full"><span>One ticker item per line</span><textarea name="announcementItems" rows={8} defaultValue={(announcement.items || []).join("\n")} /></label></div> : null}

                {card.key === "delivery" ? <div className="admin-reference-form">
                  <label className="field"><span>Delivery mode</span><select name="deliveryMode" defaultValue={delivery.mode || "FREE"}><option value="FREE">Free</option><option value="FLAT">Flat rate</option><option value="FREE_ABOVE">Free above amount</option></select></label>
                  <label className="field"><span>Flat rate</span><input type="number" name="flatRate" defaultValue={delivery.flatRate || 0} /></label>
                  <label className="field"><span>Free above</span><input type="number" name="freeAbove" defaultValue={delivery.freeAbove || 0} /></label>
                  <label className="field"><span>COD fee</span><input type="number" name="codFee" defaultValue={delivery.codFee || 0} /></label>
                  <label className="admin-check full"><input type="checkbox" name="nayaPay" defaultChecked={payments.includes("NAYAPAY")} /> Enable NayaPay when integration is configured</label>
                </div> : null}

                {card.key === "checkout" ? <div className="admin-check-grid"><label className="admin-check"><input type="checkbox" name="reqEmail" defaultChecked={required.email} /> Email required</label><label className="admin-check"><input type="checkbox" name="reqPostcode" defaultChecked={required.postcode} /> Postcode required</label><label className="admin-check"><input type="checkbox" name="reqTerms" defaultChecked={required.terms} /> Terms required</label></div> : null}

                {card.key === "cities" ? <div className="admin-reference-form"><label className="field full"><span>Pakistan delivery cities</span><textarea name="cities" rows={18} defaultValue={cities.filter((city) => city.active).map((city) => `${city.name} | ${city.deliveryMinDays} | ${city.deliveryMaxDays}`).join("\n")} /><small>One per line: City | minimum days | maximum days</small></label></div> : null}

                {card.key === "tracking" ? <div className="admin-reference-form">
                  <label className="field"><span>Meta Pixel ID</span><input name="pixel" defaultValue={pixel} /></label>
                  <label className="field"><span>Clarity project ID</span><input name="clarity" defaultValue={clarity} /></label>
                  <label className="field full"><span>Order alert recipients</span><textarea name="recipients" rows={4} defaultValue={recipients.join("\n")} /></label>
                  <label className="field full"><span>Team order email template</span><textarea name="teamTemplate" rows={9} defaultValue={teamTemplate} /></label>
                  <label className="field full"><span>Customer confirmation template</span><textarea name="customerTemplate" rows={9} defaultValue={customerTemplate} /></label>
                </div> : null}

                {card.key === "homepage" ? <div className="admin-reference-form">
                  <label className="field"><span>Hero kicker</span><input name="heroKicker" defaultValue={home.heroKicker || ""} /></label>
                  <label className="field"><span>Hero title</span><input name="heroTitle" defaultValue={home.heroTitle || ""} /></label>
                  <label className="field full"><span>Hero body</span><textarea name="heroBody" rows={4} defaultValue={home.heroBody || ""} /></label>
                  <label className="field full"><span>Popular collection videos JSON</span><textarea name="videos" rows={10} defaultValue={JSON.stringify(home.popularCollectionsVideos || [], null, 2)} /></label>
                </div> : null}

                <div className="admin-modal-footer-actions"><button className="admin-btn admin-btn-primary">Save {card.title}</button></div>
              </form>
            </AdminModal>
          </div>
        ))}
      </div>
    </>
  );
}
