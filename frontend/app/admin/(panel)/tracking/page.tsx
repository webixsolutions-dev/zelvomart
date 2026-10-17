"use client";
import AdminTable from '@/components/admin/AdminTable';


import { useAdminData, AdminError } from "@/components/admin/useAdminData";

function health(value: number) {
  return value >= 99.5 ? "Healthy" : value >= 95 ? "Check" : "Action needed";
}

function statusTone(ok: boolean) {
  return ok ? "good" : "warn";
}

interface IntegrationStatus {
  enabled: boolean;
  configured: boolean;
  id?: string;
  testEventCodeConfigured?: boolean;
  retentionDays?: number;
}

interface TrackingData {
  browser: Record<string, number>;
  server: Record<string, number>;
  tiktokServer: Record<string, number>;
  orders: number;
  acceptedPurchases: number;
  purchaseCoverage: number;
  paired: number;
  pairEligible: number;
  dedupeCoverage: number;
  lastSuccess: string | null;
  meta?: {
    server: Record<string, number>;
    acceptedPurchases: number;
    purchaseCoverage: number;
    paired: number;
    pairEligible: number;
    dedupeCoverage: number;
    lastSuccess: string | null;
  };
  tiktok?: {
    server: Record<string, number>;
    acceptedPurchases: number;
    purchaseCoverage: number;
    paired: number;
    pairEligible: number;
    dedupeCoverage: number;
    lastSuccess: string | null;
  };
  integrations?: {
    metaPixel?: IntegrationStatus;
    metaCapi?: IntegrationStatus;
    tiktokPixel?: IntegrationStatus;
    tiktokEventsApi?: IntegrationStatus;
    clarity?: IntegrationStatus;
    sessionReplay?: IntegrationStatus;
  };
  config?: {
    pixelId?: string;
    clarityId?: string;
    capiConfigured?: boolean;
    testEventCodeConfigured?: boolean;
    appEnv?: string;
    metaPixel?: IntegrationStatus;
    metaCapi?: IntegrationStatus;
    tiktokPixel?: IntegrationStatus;
    tiktokEventsApi?: IntegrationStatus;
    clarity?: IntegrationStatus;
    sessionReplay?: IntegrationStatus;
  };
  errors: Array<{
    id: string;
    createdAt: string;
    eventName: string;
    eventId: string;
    channel: string;
    error?: string;
    response?: unknown;
  }>;
}

export default function Tracking() {
  const { data, error } = useAdminData<TrackingData>("/api/admin/tracking", {
    browser: {},
    server: {},
    tiktokServer: {},
    orders: 0,
    acceptedPurchases: 0,
    purchaseCoverage: 0,
    paired: 0,
    pairEligible: 0,
    dedupeCoverage: 0,
    lastSuccess: null,
    errors: [],
    integrations: {},
    config: {},
  });

  if (error) return <AdminError message={error || "Unable to load tracking"} />;

  const names = [
    "PageView",
    "ViewContent",
    "Search",
    "AddToCart",
    "InitiateCheckout",
    "Purchase",
    "Contact",
    "Lead",
  ];

  const max = Math.max(
    1,
    ...names.flatMap((name) => [
      Number(data.browser?.[name] || 0),
      Number(data.server?.[name] || 0),
      Number(data.tiktokServer?.[name] || 0),
    ])
  );

  const metaPixel = data.integrations?.metaPixel || data.config?.metaPixel;
  const metaCapi = data.integrations?.metaCapi || data.config?.metaCapi;
  const tiktokPixel = data.integrations?.tiktokPixel || data.config?.tiktokPixel;
  const tiktokEventsApi = data.integrations?.tiktokEventsApi || data.config?.tiktokEventsApi;
  const clarity = data.integrations?.clarity || data.config?.clarity;
  const sessionReplay = data.integrations?.sessionReplay || data.config?.sessionReplay;

  const metaPurchaseCoverage = data.meta?.purchaseCoverage ?? data.purchaseCoverage ?? 0;
  const metaDedupeCoverage = data.meta?.dedupeCoverage ?? data.dedupeCoverage ?? 0;
  const metaAccepted = data.meta?.acceptedPurchases ?? data.acceptedPurchases ?? 0;
  const metaPaired = data.meta?.paired ?? data.paired ?? 0;

  const tiktokPurchaseCoverage = data.tiktok?.purchaseCoverage ?? 0;
  const tiktokDedupeCoverage = data.tiktok?.dedupeCoverage ?? 0;
  const tiktokAccepted = data.tiktok?.acceptedPurchases ?? 0;
  const tiktokPaired = data.tiktok?.paired ?? 0;

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>Tracking Health &amp; Diagnostics</h1>
          <p>
            Real-time status, event delivery volumes, and browser ↔ server deduplication metrics for Meta, TikTok, Microsoft Clarity, and CRO Replays.
          </p>
        </div>
      </div>

      {/* 6 Integration Status Cards */}
      <div className="admin-tracking-integrations-grid">
        {/* Meta Pixel */}
        <article className="admin-tracking-card" style={{ minHeight: 120 }}>
          <div>
            <small>Meta Pixel</small>
            <span className={`admin-health-pill ${statusTone(Boolean(metaPixel?.enabled && metaPixel?.configured))}`}>
              {!metaPixel?.enabled ? "Disabled" : metaPixel?.configured ? "Ready" : "Missing ID"}
            </span>
          </div>
          <strong className="status-copy">
            {!metaPixel?.enabled ? "Disabled" : metaPixel?.configured ? "Active" : "Not Set"}
          </strong>
          <p>{metaPixel?.id ? `Pixel ID: ${metaPixel.id}` : "No Pixel ID stored"}</p>
          <i style={{ width: metaPixel?.enabled && metaPixel?.configured ? "100%" : "0%" }} />
        </article>

        {/* Meta CAPI */}
        <article className="admin-tracking-card" style={{ minHeight: 120 }}>
          <div>
            <small>Meta Conversions API</small>
            <span className={`admin-health-pill ${statusTone(Boolean(metaCapi?.enabled && metaCapi?.configured))}`}>
              {!metaCapi?.enabled ? "Disabled" : metaCapi?.configured ? "Ready" : "Missing Token"}
            </span>
          </div>
          <strong className="status-copy">
            {!metaCapi?.enabled ? "Disabled" : metaCapi?.configured ? "Configured" : "No Token"}
          </strong>
          <p>Test Code: {metaCapi?.testEventCodeConfigured ? "Configured" : "None"}</p>
          <i style={{ width: metaCapi?.enabled && metaCapi?.configured ? "100%" : "0%" }} />
        </article>

        {/* TikTok Pixel */}
        <article className="admin-tracking-card" style={{ minHeight: 120 }}>
          <div>
            <small>TikTok Pixel</small>
            <span className={`admin-health-pill ${statusTone(Boolean(tiktokPixel?.enabled && tiktokPixel?.configured))}`}>
              {!tiktokPixel?.enabled ? "Disabled" : tiktokPixel?.configured ? "Ready" : "Missing ID"}
            </span>
          </div>
          <strong className="status-copy">
            {!tiktokPixel?.enabled ? "Disabled" : tiktokPixel?.configured ? "Active" : "Not Set"}
          </strong>
          <p>{tiktokPixel?.id ? `Pixel ID: ${tiktokPixel.id}` : "No Pixel ID stored"}</p>
          <i style={{ width: tiktokPixel?.enabled && tiktokPixel?.configured ? "100%" : "0%", background: "#fe2c55" }} />
        </article>

        {/* TikTok Events API */}
        <article className="admin-tracking-card" style={{ minHeight: 120 }}>
          <div>
            <small>TikTok Events API</small>
            <span className={`admin-health-pill ${statusTone(Boolean(tiktokEventsApi?.enabled && tiktokEventsApi?.configured))}`}>
              {!tiktokEventsApi?.enabled ? "Disabled" : tiktokEventsApi?.configured ? "Ready" : "Missing Token"}
            </span>
          </div>
          <strong className="status-copy">
            {!tiktokEventsApi?.enabled ? "Disabled" : tiktokEventsApi?.configured ? "Configured" : "No Token"}
          </strong>
          <p>Test Code: {tiktokEventsApi?.testEventCodeConfigured ? "Configured" : "None"}</p>
          <i style={{ width: tiktokEventsApi?.enabled && tiktokEventsApi?.configured ? "100%" : "0%", background: "#fe2c55" }} />
        </article>

        {/* Microsoft Clarity */}
        <article className="admin-tracking-card" style={{ minHeight: 120 }}>
          <div>
            <small>Microsoft Clarity</small>
            <span className={`admin-health-pill ${statusTone(Boolean(clarity?.enabled && clarity?.configured))}`}>
              {!clarity?.enabled ? "Disabled" : clarity?.configured ? "Ready" : "Missing ID"}
            </span>
          </div>
          <strong className="status-copy">
            {!clarity?.enabled ? "Disabled" : clarity?.configured ? "Configured" : "Not Set"}
          </strong>
          <p>{clarity?.id ? `Project ID: ${clarity.id}` : `${data.config?.appEnv || "development"} env`}</p>
          <i style={{ width: clarity?.enabled && clarity?.configured ? "100%" : "0%" }} />
        </article>

        {/* CRO Session Replay */}
        <article className="admin-tracking-card" style={{ minHeight: 120 }}>
          <div>
            <small>CRO Session Replay</small>
            <span className={`admin-health-pill ${statusTone(Boolean(sessionReplay?.enabled))}`}>
              {!sessionReplay?.enabled ? "Disabled" : "Active"}
            </span>
          </div>
          <strong className="status-copy">
            {!sessionReplay?.enabled ? "Disabled" : "14-Day Retention"}
          </strong>
          <p>Purge cycle: {sessionReplay?.retentionDays || 14} days retention</p>
          <i style={{ width: sessionReplay?.enabled ? "100%" : "0%" }} />
        </article>
      </div>

      {/* Deduplication & Coverage KPIs */}
      <div className="admin-tracking-kpis">
        <article className="admin-tracking-card">
          <div>
            <small>Meta Purchase Coverage</small>
            <span className={`admin-health-pill ${statusTone(metaPurchaseCoverage >= 95)}`}>
              {health(metaPurchaseCoverage)}
            </span>
          </div>
          <strong>{Number(metaPurchaseCoverage).toFixed(1)}%</strong>
          <p>{metaAccepted}/{data.orders} orders accepted by Meta CAPI</p>
          <i style={{ width: `${Math.min(100, Number(metaPurchaseCoverage))}%` }} />
        </article>

        <article className="admin-tracking-card">
          <div>
            <small>Meta Browser ↔ Server Pairing</small>
            <span className={`admin-health-pill ${statusTone(metaDedupeCoverage >= 95)}`}>
              {health(metaDedupeCoverage)}
            </span>
          </div>
          <strong>{Number(metaDedupeCoverage).toFixed(1)}%</strong>
          <p>{metaPaired}/{data.pairEligible} event IDs paired</p>
          <i style={{ width: `${Math.min(100, Number(metaDedupeCoverage))}%` }} />
        </article>

        <article className="admin-tracking-card">
          <div>
            <small>TikTok Purchase Coverage</small>
            <span className={`admin-health-pill ${statusTone(tiktokPurchaseCoverage >= 95)}`}>
              {health(tiktokPurchaseCoverage)}
            </span>
          </div>
          <strong>{Number(tiktokPurchaseCoverage).toFixed(1)}%</strong>
          <p>{tiktokAccepted}/{data.orders} orders accepted by TikTok Events API</p>
          <i style={{ width: `${Math.min(100, Number(tiktokPurchaseCoverage))}%`, background: "#fe2c55" }} />
        </article>

        <article className="admin-tracking-card">
          <div>
            <small>TikTok Browser ↔ Server Pairing</small>
            <span className={`admin-health-pill ${statusTone(tiktokDedupeCoverage >= 95)}`}>
              {health(tiktokDedupeCoverage)}
            </span>
          </div>
          <strong>{Number(tiktokDedupeCoverage).toFixed(1)}%</strong>
          <p>{tiktokPaired}/{data.pairEligible} event IDs paired</p>
          <i style={{ width: `${Math.min(100, Number(tiktokDedupeCoverage))}%`, background: "#fe2c55" }} />
        </article>
      </div>

      {/* Event delivery breakdown */}
      <section className="admin-section-card admin-event-health-card">
        <div className="admin-section-head">
          <div>
            <h2>Event Delivery Breakdown</h2>
            <p>Browser Pixel, Meta CAPI, and TikTok Events API counts across the last 7 days.</p>
          </div>
          <div className="admin-chart-legend">
            <span><i className="browser" />Browser</span>
            <span><i className="server" />Meta CAPI</span>
            <span><i className="tiktok" />TikTok Server</span>
          </div>
        </div>

        <div className="admin-event-bars">
          {names.map((name) => {
            const browser = Number(data.browser?.[name] || 0);
            const server = Number(data.server?.[name] || 0);
            const tiktok = Number(data.tiktokServer?.[name] || 0);

            return (
              <div className="admin-event-row three-way" key={name}>
                <b>{name}</b>
                <div className="admin-event-pair">
                  <span>
                    <i
                      className="browser"
                      style={{ width: `${Math.max(browser ? 3 : 0, (browser / max) * 100)}%` }}
                    />
                  </span>
                  <span>
                    <i
                      className="server"
                      style={{ width: `${Math.max(server ? 3 : 0, (server / max) * 100)}%` }}
                    />
                  </span>
                  <span>
                    <i
                      className="tiktok"
                      style={{ width: `${Math.max(tiktok ? 3 : 0, (tiktok / max) * 100)}%` }}
                    />
                  </span>
                </div>
                <div>
                  <strong title={`Browser: ${browser}`}>{browser}</strong>
                  <small title={`Meta CAPI: ${server}`}>{server}</small>
                  <em title={`TikTok Server: ${tiktok}`}>{tiktok}</em>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Bottom section: Last delivery timestamps and recent errors */}
      <div className="admin-tracking-bottom-grid">
        <section className="admin-section-card">
          <div className="admin-section-head">
            <div>
              <h2>Delivery Status</h2>
              <p>Last recorded server events &amp; environment configuration.</p>
            </div>
          </div>
          <div style={{ display: "grid", gap: 14, marginTop: 10 }}>
            <div>
              <small style={{ fontSize: 10, color: "#718692", textTransform: "uppercase", fontWeight: 700 }}>
                Meta Server Last Success
              </small>
              <strong className="admin-last-event" style={{ marginTop: 4 }}>
                {data.meta?.lastSuccess || data.lastSuccess
                  ? new Date(data.meta?.lastSuccess || data.lastSuccess || "").toLocaleString("en-PK")
                  : "No successful Meta CAPI event yet"}
              </strong>
            </div>
            <div>
              <small style={{ fontSize: 10, color: "#718692", textTransform: "uppercase", fontWeight: 700 }}>
                TikTok Server Last Success
              </small>
              <strong className="admin-last-event" style={{ marginTop: 4 }}>
                {data.tiktok?.lastSuccess
                  ? new Date(data.tiktok.lastSuccess).toLocaleString("en-PK")
                  : "No successful TikTok event yet"}
              </strong>
            </div>
            <p style={{ marginTop: 6, fontSize: 11, color: "#738792", lineHeight: 1.5 }}>
              Meta Test Event Code: {metaCapi?.testEventCodeConfigured ? "configured" : "not configured"}.<br />
              TikTok Test Event Code: {tiktokEventsApi?.testEventCodeConfigured ? "configured" : "not configured"}.<br />
              Live production storefronts should leave test event codes empty.
            </p>
          </div>
        </section>

        <section className="admin-section-card">
          <div className="admin-section-head">
            <div>
              <h2>Recent Server Errors</h2>
              <p>Latest delivery failures from Meta CAPI and TikTok Events API.</p>
            </div>
          </div>
          <div className="admin-table-wrap">
            <AdminTable scrollLabel="Tracking" className="admin-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Channel</th>
                  <th>Event</th>
                  <th>ID</th>
                  <th>Error Details</th>
                </tr>
              </thead>
              <tbody>
                {(data.errors || []).map((e) => {
                  const isTikTok = e.channel === "tiktok-server";
                  return (
                    <tr key={e.id}>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {new Date(e.createdAt).toLocaleString("en-PK")}
                      </td>
                      <td>
                        <span
                          className={`admin-health-pill ${isTikTok ? "warn" : "good"}`}
                          style={{
                            background: isTikTok ? "#fff0f3" : "#eaf8ef",
                            color: isTikTok ? "#fe2c55" : "#13884d",
                          }}
                        >
                          {isTikTok ? "TikTok" : "Meta"}
                        </span>
                      </td>
                      <td><b>{e.eventName}</b></td>
                      <td style={{ fontFamily: "monospace", fontSize: 11 }}>{e.eventId}</td>
                      <td style={{ maxWidth: 380, whiteSpace: "normal", wordBreak: "break-word" }}>
                        {e.error || JSON.stringify(e.response) || "—"}
                      </td>
                    </tr>
                  );
                })}
                {!data.errors?.length ? (
                  <tr>
                    <td colSpan={5}>No server-side tracking errors in the last 7 days.</td>
                  </tr>
                ) : null}
              </tbody>
            </AdminTable>
          </div>
        </section>
      </div>
    </>
  );
}
