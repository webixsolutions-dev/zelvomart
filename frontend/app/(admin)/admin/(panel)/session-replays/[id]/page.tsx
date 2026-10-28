"use client";
import ReplayStatCards, {
  ReplaySkeleton,
} from "@/components/admin/ReplayStatCards";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { clientApi } from "@/lib/client-api";
import {
  replayPayload,
  replayRecords,
  type ReplayRecord,
} from "@/lib/replay-data";
import { SITE_ORIGIN } from "@/lib/site-url";
import { useAdminRole } from "@/components/admin/AdminRoleContext";
import SessionReplayPlayer from "@/components/admin/SessionReplayPlayer";
import "./replay.css";
type Marker = {
  eventName: string;
  sourceUrl?: string;
  createdAt: string;
  payload?: { occurredAt?: number };
};
type Detail = {
  session: {
    id: string;
    visitorId: string;
    source: string;
    campaign?: string;
    device?: string;
    viewport?: string;
    startedAt: string;
    lastSeenAt: string;
    status?: string;
    durationMs: number;
    pageViews: number;
    ordered: boolean;
    reachedCart: boolean;
    reachedCheckout: boolean;
  };
  order?: { id: string; orderNumber: string };
  markers: Marker[];
  chunks: { sequence: number }[];
  bootstrap?: ReplayRecord;
  legacy?: ReplayRecord[] | null;
};
const time = (ms: number) => {
  const s = Math.floor(Math.max(0, Number.isFinite(ms) ? ms : 0) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const markerTime = (marker: Marker) =>
  Number.isFinite(marker.payload?.occurredAt)
    ? Number(marker.payload!.occurredAt)
    : Date.parse(marker.createdAt);
const markerPath = (url?: string) => {
  try {
    return url ? new URL(url, SITE_ORIGIN).pathname : "";
  } catch {
    return "";
  }
};
const eventLabel = (name: string) =>
  ({
    PageView: "Page viewed",
    ViewContent: "Product viewed",
    AddToCart: "Added to cart",
    InitiateCheckout: "Checkout started",
    Purchase: "Order placed",
    ReplayError: "Page error",
    ReplayRageClick: "Repeated clicks",
  })[name] || name;
const eventIcon = (name: string) =>
  ({
    PageView: "↗",
    ViewContent: "◈",
    AddToCart: "+",
    InitiateCheckout: "→",
    Purchase: "✓",
    ReplayError: "!",
    ReplayRageClick: "!",
  })[name] || "•";
const errorText = (message: string) =>
  (
    ({
      DATABASE_UNAVAILABLE:
        "Database temporarily unavailable. Your loaded recording is still available.",
      RECORDING_FILE_EXPIRED:
        "This recording file has expired or is no longer available.",
      REPLAY_STORAGE_UNAVAILABLE:
        "Recording storage is temporarily unavailable. Retrying…",
    }) as Record<string, string>
  )[message] || message;
export default function ReplayDetail() {
  const role = useAdminRole(),
    canDelete = role === "OWNER" || role === "MANAGER";
  const { id } = useParams<{ id: string }>(),
    router = useRouter(),
    search = useSearchParams(),
    live = search.get("live") === "1";
  const [detail, setDetail] = useState<Detail | null>(null),
    [events, setEvents] = useState<ReplayRecord[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [unavailable, setUnavailable] = useState(false),
    [deleting, setDeleting] = useState(false),
    [progress, setProgress] = useState({ loaded: 0, total: 0 }),
    [seek, setSeek] = useState<number>(),
    [attempt, setAttempt] = useState(0),
    [ended, setEnded] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined,
      failures = 0,
      legacyCount = 0,
      bootstrapped = false;
    const seen = new Set<number>();
    setDetail(null);
    setEvents([]);
    setLoading(true);
    setError("");
    setUnavailable(false);
    setProgress({ loaded: 0, total: 0 });
    setSeek(undefined);
    setEnded(false);
    const signal = () =>
      AbortSignal.any([abort.signal, AbortSignal.timeout(45000)]);
    async function load() {
      try {
        const raw = await clientApi<unknown>(
          `/api/admin/session-replays/${encodeURIComponent(id)}${live ? "?live=1" : ""}`,
          { signal: signal() },
          true,
        );
        if (abort.signal.aborted) return;
        const next = replayPayload(raw) as Detail;
        setDetail(next);
        const finished =
          next.session.status === "ENDED" ||
          Date.now() - Date.parse(next.session.lastSeenAt) > 30 * 60000;
        setEnded(finished);
        if (next.legacy) {
          const appended = next.legacy.slice(legacyCount);
          legacyCount = next.legacy.length;
          if (appended.length)
            setEvents((previous) => [...previous, ...appended]);
          setProgress({ loaded: next.legacy.length ? 1 : 0, total: 1 });
        } else {
          if (!bootstrapped && next.bootstrap) {
            setEvents([next.bootstrap]);
            bootstrapped = true;
          }
          const loaded = () =>
            next.chunks.filter((chunk) => seen.has(chunk.sequence)).length;
          setProgress({ loaded: loaded(), total: next.chunks.length });
          for (const chunk of next.chunks) {
            if (seen.has(chunk.sequence)) continue;
            const data = await clientApi<{ url?: string; events?: unknown }>(
              `/api/admin/session-replays/${encodeURIComponent(id)}/chunks/${chunk.sequence}`,
              { signal: signal() },
              true,
            );
            let records = data.events;
            if (data.url) {
              try {
                if (
                  !["localhost", "zelvomart.vercel.app"].includes(
                    location.hostname,
                  )
                )
                  throw new Error("Use authenticated playback for this domain");
                const response = await fetch(data.url, {
                  signal: signal(),
                  credentials: "omit",
                  cache: "no-store",
                });
                if (!response.ok)
                  throw new Error("Direct recording fetch failed");
                records = await response.json();
              } catch {
                if (abort.signal.aborted) return;
                const fallback = await clientApi<{ events: unknown }>(
                  `/api/admin/session-replays/${encodeURIComponent(id)}/chunks/${chunk.sequence}?download=1`,
                  { signal: signal() },
                  true,
                );
                records = fallback.events;
              }
            }
            if (!Array.isArray(records))
              throw new Error(
                "The backend returned an invalid recording chunk.",
              );
            if (abort.signal.aborted) return;
            const valid = replayRecords(records);
            seen.add(chunk.sequence);
            if (valid.length) setEvents((previous) => [...previous, ...valid]);
            setProgress({ loaded: loaded(), total: next.chunks.length });
          }
        }
        if (abort.signal.aborted) return;
        failures = 0;
        setLoading(false);
        setError("");
        if (live && !finished) timer = setTimeout(() => void load(), 5000);
      } catch (e) {
        if (abort.signal.aborted) return;
        setLoading(false);
        const message =
          e instanceof Error
            ? e.name === "TimeoutError"
              ? "The recording request timed out. Retrying…"
              : e.message
            : "Recording failed to load.";
        const friendly =
          (
            {
              DATABASE_UNAVAILABLE:
                "The database is temporarily unavailable. Loaded playback is preserved while we retry.",
              RECORDING_FILE_EXPIRED:
                "This recording has expired or is no longer available.",
              REPLAY_STORAGE_UNAVAILABLE:
                "Recording storage is temporarily unavailable. Retrying…",
              NOT_FOUND: "The requested item is no longer available.",
            } as Record<string, string>
          )[message] || message;
        if (
          friendly ===
            "This recording has expired or is no longer available." ||
          friendly === "The requested item is no longer available."
        ) {
          // Missing R2 objects cannot be played again. Remove their stale index so they also disappear from the list.
          if (
            friendly === "This recording has expired or is no longer available."
          ) {
            try {
              await clientApi(
                `/api/admin/session-replays/${encodeURIComponent(id)}`,
                { method: "DELETE" },
                true,
              );
              setError(
                "This recording has expired or is no longer available. Its stale entry has been removed from the recordings list.",
              );
            } catch {
              setError(
                "This recording has expired or is no longer available. Return to the recordings list and try refreshing it.",
              );
            }
          } else setError(friendly);
          setUnavailable(true);
          return;
        }
        setError(friendly);
        // Keep already-loaded video visible and recover the failed chunk with a new URL.
        if (failures++ < 5)
          timer = setTimeout(
            () => void load(),
            Math.min(30000, 2000 * 2 ** (failures - 1)),
          );
      }
    }
    void load();
    return () => {
      abort.abort();
      if (timer) clearTimeout(timer);
    };
  }, [id, live, attempt]);
  async function deleteRecording() {
    if (
      !window.confirm(
        "Delete this recording and its stored R2 chunks? This cannot be undone.",
      )
    )
      return;
    setDeleting(true);
    try {
      await clientApi(
        `/api/admin/session-replays/${encodeURIComponent(id)}`,
        { method: "DELETE" },
        true,
      );
      router.replace("/admin/session-replays");
    } catch {
      setDeleting(false);
    }
  }
  if (unavailable)
    return (
      <div className="replay-workspace">
        <section className="admin-card replay-notice" role="status">
          <div>
            <h1>Recording unavailable</h1>
            <p>{error}</p>
          </div>
          <Link
            className="admin-btn admin-btn-primary"
            href="/admin/session-replays"
          >
            Back to recordings
          </Link>
        </section>
      </div>
    );
  const session = detail?.session,
    start =
      events[0]?.timestamp || (session ? Date.parse(session.startedAt) : 0);
  const outcome = session?.ordered
    ? "Ordered"
    : session?.reachedCheckout
      ? "Reached checkout"
      : session?.reachedCart
        ? "Added to cart"
        : "Browsed";
  return (
    <div className="replay-workspace">
      <header className="admin-title">
        <div>
          <Link href="/admin/session-replays">← Session Replays</Link>
          <h1>
            {session ? (
              `Replay #${session.visitorId.slice(0, 8)}`
            ) : (
              <ReplaySkeleton className="replay-title-skeleton" />
            )}
          </h1>
          {session && (
            <p>
              {session.source}
              {session.campaign ? ` · ${session.campaign}` : ""} ·{" "}
              {session.device || "Unknown device"} · {time(session.durationMs)}{" "}
              · {session.pageViews} pages · {outcome}
            </p>
          )}
        </div>
        <div className="replay-header-actions">
          <Link
            className="admin-btn admin-btn-light"
            href={`/admin/session-replays/${id}${live ? "" : "?live=1"}`}
          >
            {live ? "Recorded playback" : "Watch live"}
          </Link>
          {session && (
            <Link href={`/admin/session-replays?visitor=${session.visitorId}`}>
              Other sessions from this visitor
            </Link>
          )}
          {detail?.order && (
            <Link href={`/admin/orders/${detail.order.id}`}>
              {detail.order.orderNumber}
            </Link>
          )}
          {session && canDelete && (
            <button
              className="admin-btn admin-btn-light"
              disabled={deleting}
              onClick={() => void deleteRecording()}
            >
              {deleting ? "Deleting…" : "Delete recording"}
            </button>
          )}
        </div>
      </header>
      {error && (
        <div className="admin-card replay-notice" role="alert">
          <span>{errorText(error)}</span>
          <button
            className="admin-btn admin-btn-light"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Retry recording
          </button>
        </div>
      )}
      <ReplayStatCards
        loading={!session && loading}
        items={[
          {
            label: "Recorded duration",
            value: session ? time(session.durationMs) : "—",
            description: "Visitor session",
          },
          {
            label: "Pages visited",
            value: session?.pageViews ?? "—",
            description: "Across the journey",
          },
          {
            label: "Journey events",
            value: detail?.markers.length ?? "—",
            description: "Select an event to jump",
          },
          {
            label: "Furthest step",
            value: session ? outcome : "—",
            description:
              live && !ended ? "Live updates enabled" : "Recorded playback",
          },
        ]}
      />
      <p role="status" className="replay-progress">
        {loading ? (
          <ReplaySkeleton className="replay-progress-skeleton" />
        ) : live ? (
          ended ? (
            "Session ended · recorded playback available"
          ) : (
            "Live · checking for new activity every 5 seconds"
          )
        ) : (
          `${progress.loaded} recording parts loaded`
        )}
      </p>
      <div className="replay-journey-layout">
        <section>
          <SessionReplayPlayer
            key={`${id}:${attempt}`}
            events={events}
            loading={loading}
            live={live && !ended}
            waiting={live && !ended}
            seekTo={seek}
          />
          <div className="replay-timeline" aria-label="Journey timeline">
            {detail?.markers.map((marker, index) => (
              <button
                key={index}
                title={marker.sourceUrl}
                className={`marker-${marker.eventName.toLowerCase()}`}
                onClick={() => setSeek(Math.max(0, markerTime(marker) - start))}
              >
                {time(markerTime(marker) - start)} · {marker.eventName}
              </button>
            ))}
          </div>
        </section>
        <aside className="admin-card replay-journey">
          <header>
            <h2>Customer journey</h2>
            <span>{detail?.markers.length || 0} events</span>
          </header>
          <p>Follow each step. Select an event to jump to that moment.</p>
          <div className="replay-journey-list">
            {!detail &&
              loading &&
              Array.from({ length: 5 }, (_, i) => (
                <div className="replay-loading-shell" key={i}>
                  <ReplaySkeleton />
                </div>
              ))}
            {detail?.markers.map((marker, index) => {
              const offset = Math.max(0, markerTime(marker) - start);
              return (
                <button
                  key={index}
                  data-event={marker.eventName}
                  aria-pressed={seek === offset}
                  onClick={() => setSeek(offset)}
                >
                  <span className="replay-event-icon" aria-hidden="true">
                    {eventIcon(marker.eventName)}
                  </span>
                  <span className="replay-event-copy">
                    <b>{eventLabel(marker.eventName)}</b>
                    <small title={marker.sourceUrl}>
                      {markerPath(marker.sourceUrl)}
                    </small>
                    <time>{time(offset)}</time>
                  </span>
                </button>
              );
            })}
          </div>
          {!loading && !detail?.markers.length && (
            <p>No tracked journey markers.</p>
          )}
          <footer>
            Idle gaps over 10 seconds are skipped by default. Recording pauses
            after 2 minutes without interaction, or immediately in a background
            tab. Activity resumes recording; after 30 minutes it starts a new
            session.
          </footer>
        </aside>
      </div>
    </div>
  );
}
