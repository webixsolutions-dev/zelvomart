"use client";

import { FormEvent, useState } from "react";

export default function TrackOrderClient() {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true); setError(""); setResult(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/orders/track", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderNumber: form.get("orderNumber"), phone: form.get("phone") }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Order not found"); else setResult(data);
    setLoading(false);
  };

  return (
    <div className="content-card">
      <form onSubmit={submit} className="form-grid">
        <div className="field"><label>Order number</label><input name="orderNumber" placeholder="ZM-10001" required /></div>
        <div className="field"><label>Phone</label><input name="phone" placeholder="03XX-XXXXXXX" required /></div>
        <div className="field full"><button className="btn-primary" disabled={loading}>{loading ? "Checking..." : "Track Order"}</button></div>
      </form>
      {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</p> : null}
      {result ? <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4"><b>{result.orderNumber}</b><p className="mt-2">Status: <strong>{String(result.status).replace(/_/g, " ")}</strong></p><p>City: {result.city}</p>{result.trackingUrl ? <a className="btn-outline mt-3" href={result.trackingUrl} target="_blank" rel="noreferrer">Open PostEx tracking</a> : <p className="text-sm text-slate-500">Courier tracking will appear after booking.</p>}</div> : null}
    </div>
  );
}
