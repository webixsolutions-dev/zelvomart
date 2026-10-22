"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  Clock3,
  Mail,
  RefreshCw,
  Server,
  TriangleAlert,
} from "lucide-react";
import { adminFetch } from "@/lib/client-api";
import { useAdminRole } from "./AdminRoleContext";
import "./system-health.css";
type Health = {
  checkedAt: string;
  healthy: boolean;
  worker: {
    state: "running" | "stale" | "not-running";
    lastHeartbeat: string | null;
    ageSeconds: number | null;
  };
  jobs: {
    queued: number;
    oldestQueuedAt: string | null;
    oldestQueuedAgeSeconds: number | null;
    failedLast24Hours: number;
  };
  email: {
    lastSuccessfulAt: string | null;
    ageSeconds: number | null;
    source: "transport" | "job" | null;
  };
};
function duration(seconds: number | null) {
  if (seconds === null) return "Not available";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
function HealthContent() {
  const [data, setData] = useState<Health | null>(null),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(false),
    [denied, setDenied] = useState(false),
    request = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    try {
      const response = await adminFetch("/api/admin/system-health", {
        signal: controller.signal,
      });
      if (response.status === 403) {
        setDenied(true);
        setData(null);
        return;
      }
      if (!response.ok) throw new Error("Health unavailable");
      const next = (await response.json()) as Health;
      if (!controller.signal.aborted) {
        setData(next);
        setError(false);
      }
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30000);
    return () => {
      clearInterval(timer);
      request.current?.abort();
    };
  }, [refresh]);
  if (denied) return null;
  const workerBad = !!data && data.worker.state !== "running",
    title = !data
      ? "Checking services"
      : data.worker.state === "not-running"
        ? "Worker not running"
        : data.worker.state === "stale"
          ? "Worker heartbeat is stale"
          : data.healthy
            ? "Services are healthy"
            : "Recent job failures need attention";
  return (
    <section
      className={`system-health-card ${workerBad ? "is-unhealthy" : ""}`}
      aria-label="System health"
    >
      <header>
        <span className="system-health-icon">
          <Activity size={21} />
        </span>
        <div>
          <h2>System health</h2>
          <p>
            Background processing and email delivery · updates every 30 seconds
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={busy}
          aria-label="Refresh system health"
        >
          <RefreshCw size={15} className={busy ? "is-spinning" : ""} />
          {busy ? "Checking…" : "Refresh"}
        </button>
      </header>
      {error ? (
        <div className="system-health-error" role="alert">
          <TriangleAlert size={19} />
          <p>
            Health data could not be refreshed.{" "}
            {data
              ? "The last successful check is shown below."
              : "Please try again."}
          </p>
        </div>
      ) : null}
      {data ? (
        <>
          <div
            className={`system-health-status ${workerBad ? "is-bad" : data.healthy ? "is-good" : "is-warning"}`}
          >
            <span />
            {title}
            <small>
              {workerBad
                ? "Deploy or restart the background worker after reviewing the backlog."
                : data.healthy
                  ? "Heartbeat received within the last two minutes."
                  : "Check failed jobs before retrying any sends."}
            </small>
          </div>
          <div className="system-health-metrics">
            <article>
              <Server size={17} />
              <span>Worker heartbeat</span>
              <strong>{duration(data.worker.ageSeconds)}</strong>
              <small>
                {data.worker.lastHeartbeat
                  ? new Date(data.worker.lastHeartbeat).toLocaleString("en-PK")
                  : "No heartbeat has been recorded"}
              </small>
            </article>
            <article>
              <Activity size={17} />
              <span>Queued jobs</span>
              <strong>{data.jobs.queued.toLocaleString()}</strong>
              <small>Waiting for a worker</small>
            </article>
            <article>
              <Clock3 size={17} />
              <span>Oldest queued job</span>
              <strong>
                {data.jobs.oldestQueuedAt
                  ? duration(data.jobs.oldestQueuedAgeSeconds)
                  : "Queue empty"}
              </strong>
              <small>
                {data.jobs.oldestQueuedAt
                  ? new Date(data.jobs.oldestQueuedAt).toLocaleString("en-PK")
                  : "Nothing is waiting"}
              </small>
            </article>
            <article>
              <TriangleAlert size={17} />
              <span>Failed in 24 hours</span>
              <strong>{data.jobs.failedLast24Hours.toLocaleString()}</strong>
              <small>Based on failure completion time</small>
            </article>
            <article>
              <Mail size={17} />
              <span>Last successful email</span>
              <strong>
                {data.email.lastSuccessfulAt
                  ? duration(data.email.ageSeconds)
                  : "No success recorded"}
              </strong>
              <small>
                {data.email.lastSuccessfulAt
                  ? new Date(data.email.lastSuccessfulAt).toLocaleString(
                      "en-PK",
                    )
                  : "No acknowledged email delivery yet"}
              </small>
            </article>
          </div>
          <footer>
            Last checked {new Date(data.checkedAt).toLocaleTimeString("en-PK")}{" "}
            · Missing worker data is reported explicitly; no jobs are started or
            retried here.
          </footer>
        </>
      ) : !error ? (
        <div className="system-health-loading" aria-busy="true">
          Checking worker, queue and email status…
        </div>
      ) : null}
    </section>
  );
}
export default function SystemHealthCard() {
  const role = useAdminRole();
  return role === "OWNER" || role === "MANAGER" ? <HealthContent /> : null;
}
