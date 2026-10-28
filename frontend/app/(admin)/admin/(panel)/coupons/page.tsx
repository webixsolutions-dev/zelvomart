"use client";
import AdminListView from "@/components/admin/AdminListView";
import "@/components/admin/catalog-pages.css";
import { useState, type FormEvent } from "react";
import AdminTable from "@/components/admin/AdminTable";
import {
  useAdminData,
  AdminLoading,
  AdminError,
} from "@/components/admin/useAdminData";
import { clientApi } from "@/lib/client-api";
import { clearAdminDataCache } from "@/components/admin/useAdminData";
import { money } from "@/lib/format";
import { toast } from "react-toastify";
export default function Coupons() {
  const { data, loading, error, reload } = useAdminData<any[]>(
    "/api/admin/coupons",
    [],
  );
  const [editing, setEditing] = useState<any>(null),
    [saving, setSaving] = useState(false),
    [discountType, setDiscountType] = useState("PERCENT"),
    [selected, setSelected] = useState<string[]>([]),
    [deleting, setDeleting] = useState(false);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await clientApi(
        "/api/admin/coupons" + (editing.id ? "/" + editing.id : ""),
        {
          method: editing.id ? "PUT" : "POST",
          body: JSON.stringify({
            code: f.get("code"),
            type: f.get("type"),
            amount: Number(f.get("amount")),
            expiresAt: f.get("expiresAt"),
            active: f.get("active") === "on",
          }),
        },
        true,
      );
      setEditing(null);
      clearAdminDataCache("/api/admin/coupons");
      await reload();
      toast.success("Coupon saved.");
    } catch {
    } finally {
      setSaving(false);
    }
  }
  async function deleteCoupons(ids: string[]) {
    if (!ids.length || deleting) return;
    const count = ids.length;
    if (
      !window.confirm(
        `Permanently delete ${count} coupon${count === 1 ? "" : "s"}? Past order coupon text remains unchanged.`,
      )
    )
      return;
    const typedConfirmation =
      count > 10
        ? window.prompt(`Type DELETE to confirm removal of ${count} coupons.`)
        : undefined;
    if (count > 10 && typedConfirmation !== "DELETE") return;
    setDeleting(true);
    try {
      const result = await clientApi<{
        deleted: string[];
        skipped: string[];
        errors: { id: string; error: string }[];
      }>(
        "/api/admin/coupons/bulk-delete",
        {
          method: "POST",
          body: JSON.stringify({
            ids,
            confirmationCount: count,
            typedConfirmation,
          }),
        },
        true,
      );
      clearAdminDataCache("/api/admin/coupons");
      await reload();
      setSelected([]);
      toast.success(
        `${result.deleted.length} coupons deleted; ${result.skipped.length} skipped; ${result.errors.length} errors.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }
  async function deactivateCoupon(c: any) {
    if (!window.confirm(`Deactivate coupon ${c.code}?`)) return;
    setDeleting(true);
    try {
      await clientApi(`/api/admin/coupons/${c.id}`, { method: "DELETE" }, true);
      clearAdminDataCache("/api/admin/coupons");
      await reload();
      toast.success("Coupon deactivated.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not deactivate coupon",
      );
    } finally {
      setDeleting(false);
    }
  }
  return (
    <div className="admin-catalog-page">
      <div className="admin-title">
        <div>
          <h1>Coupons</h1>
          <p>
            Percentage or fixed discounts applied before delivery. Expiry uses
            Pakistan time.
          </p>
        </div>
        <button
          className="admin-btn admin-btn-primary"
          disabled={saving}
          onClick={() => {
            setDiscountType("PERCENT");
            setEditing({ active: true, type: "PERCENT" });
          }}
        >
          Add coupon
        </button>
      </div>
      {selected.length > 0 && (
        <div className="admin-bulk-bar">
          <b>{selected.length} coupons selected</b>
          <button
            className="admin-btn admin-btn-danger"
            disabled={deleting}
            onClick={() => void deleteCoupons(selected)}
          >
            {deleting ? "Deleting…" : "Delete selected"}
          </button>
          <button
            className="admin-btn admin-btn-light"
            onClick={() => setSelected([])}
          >
            Clear
          </button>
        </div>
      )}
      {editing && (
        <form
          className="admin-reference-form admin-card catalog-form"
          aria-busy={saving}
          onSubmit={save}
          key={editing.id || "new"}
        >
          <label className="field">
            Code
            <input
              required
              name="code"
              maxLength={40}
              pattern="[A-Za-z0-9_-]{2,40}"
              defaultValue={editing.code}
            />
          </label>
          <label className="field">
            Discount type
            <select
              name="type"
              value={discountType}
              onChange={(event) => setDiscountType(event.target.value)}
            >
              <option value="PERCENT">Percentage</option>
              <option value="FIXED">Fixed amount (PKR)</option>
            </select>
          </label>
          <label className="field">
            Amount
            <input
              name="amount"
              type="number"
              min={discountType === "PERCENT" ? 1 : 0.01}
              max={discountType === "PERCENT" ? 100 : undefined}
              step="0.01"
              required
              defaultValue={editing.amount}
            />
          </label>
          <label className="field">
            Expiry date
            <input
              name="expiresAt"
              type="date"
              defaultValue={
                editing.expiresAt
                  ? new Date(
                      new Date(editing.expiresAt).getTime() + 5 * 3600000,
                    )
                      .toISOString()
                      .slice(0, 10)
                  : ""
              }
            />
          </label>
          <label className="admin-check">
            <input
              type="checkbox"
              name="active"
              defaultChecked={editing.active}
            />
            Active
          </label>
          <div className="catalog-form-actions">
            <button className="admin-btn admin-btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save coupon"}
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-light"
              disabled={saving}
              onClick={() => setEditing(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {loading ? (
        <AdminLoading />
      ) : error ? (
        <AdminError message={error} />
      ) : (
        <AdminListView
          rows={data}
          label="Coupons"
          search={(r) => `${r.code} ${r.type}`}
          searchHint="Search coupon code or type"
          sorts={[
            { label: "Code", value: (r) => r.code },
            { label: "Times used", value: (r) => Number(r.usedCount) || 0 },
            { label: "Revenue", value: (r) => Number(r.revenue) || 0 },
          ]}
          filters={[
            {
              label: "Status",
              value: (r) =>
                !r.active
                  ? "Off"
                  : r.expiresAt && Date.parse(r.expiresAt) < Date.now()
                    ? "Expired"
                    : "Active",
            },
            {
              label: "Type",
              value: (r) =>
                r.type === "PERCENT" ? "Percentage" : "Fixed amount",
            },
          ]}
          metrics={[
            { label: "Coupons", value: (r) => r.length },
            {
              label: "Active",
              value: (r) =>
                r.filter(
                  (c) =>
                    c.active &&
                    (!c.expiresAt || Date.parse(c.expiresAt) >= Date.now()),
                ).length,
            },
            {
              label: "Redemptions",
              value: (r) =>
                r.reduce((n, c) => n + (Number(c.usedCount) || 0), 0),
            },
            {
              label: "Revenue",
              value: (r) =>
                money(r.reduce((n, c) => n + (Number(c.revenue) || 0), 0)),
            },
          ]}
          onRefresh={reload}
        >
          {(visibleRows) => (
            <AdminTable scrollLabel="Coupons" className="admin-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Select visible coupons"
                      checked={
                        visibleRows.length > 0 &&
                        visibleRows.every((c) => selected.includes(c.id))
                      }
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [
                                ...new Set([
                                  ...selected,
                                  ...visibleRows.map((c) => c.id),
                                ]),
                              ]
                            : selected.filter(
                                (id) => !visibleRows.some((c) => c.id === id),
                              ),
                        )
                      }
                    />
                  </th>
                  {[
                    "Code",
                    "Type",
                    "Amount",
                    "Expiry",
                    "Status",
                    "Times used",
                    "Revenue",
                    "Actions",
                  ].map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!visibleRows.length && (
                  <tr>
                    <td colSpan={9}>
                      No coupons yet. Add a coupon to create your first
                      discount.
                    </td>
                  </tr>
                )}
                {visibleRows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select coupon ${c.code}`}
                        checked={selected.includes(c.id)}
                        onChange={(e) =>
                          setSelected((current) =>
                            e.target.checked
                              ? [...current, c.id]
                              : current.filter((id) => id !== c.id),
                          )
                        }
                      />
                    </td>
                    <td>{c.code}</td>
                    <td>
                      {c.type === "PERCENT" ? "Percentage" : "Fixed amount"}
                    </td>
                    <td>
                      {c.type === "PERCENT" ? c.amount + "%" : money(c.amount)}
                    </td>
                    <td>
                      {c.expiresAt
                        ? new Date(c.expiresAt).toLocaleDateString("en-PK", {
                            timeZone: "Asia/Karachi",
                          })
                        : "No expiry"}
                    </td>
                    <td>
                      <span className="catalog-status">
                        {!c.active
                          ? "Off"
                          : c.expiresAt && Date.parse(c.expiresAt) < Date.now()
                            ? "Expired"
                            : "Active"}
                      </span>
                    </td>
                    <td>{c.usedCount}</td>
                    <td>{money(c.revenue)}</td>
                    <td>
                      <button
                        className="admin-btn admin-btn-light"
                        disabled={saving}
                        aria-label={`Edit coupon ${c.code}`}
                        onClick={() => {
                          setDiscountType(c.type);
                          setEditing(c);
                        }}
                      >
                        Edit
                      </button>
                      {c.active && (
                        <button
                          className="admin-btn admin-btn-light"
                          disabled={deleting}
                          onClick={() => void deactivateCoupon(c)}
                        >
                          Deactivate
                        </button>
                      )}
                      <button
                        className="admin-btn admin-btn-danger"
                        disabled={deleting}
                        onClick={() => void deleteCoupons([c.id])}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
          )}
        </AdminListView>
      )}
    </div>
  );
}
