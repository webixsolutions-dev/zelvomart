"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { API_BASE } from "@/lib/client-api";

function readAssignments(): Record<string, string> {
  const row = document.cookie.split("; ").find((part) => part.startsWith("zm_experiments="));
  if (!row) return {};
  try { return JSON.parse(decodeURIComponent(row.slice("zm_experiments=".length))); } catch { return {}; }
}


function getVisitorId() {
  const row = document.cookie.split("; ").find((part) => part.startsWith("zm_experiment_visitor="));
  if (row) return decodeURIComponent(row.slice("zm_experiment_visitor=".length));
  const id = crypto.randomUUID();
  document.cookie = `zm_experiment_visitor=${encodeURIComponent(id)}; Max-Age=2592000; Path=/; SameSite=Lax`;
  return id;
}

function writeAssignments(value: Record<string, string>) {
  document.cookie = `zm_experiments=${encodeURIComponent(JSON.stringify(value))}; Max-Age=2592000; Path=/; SameSite=Lax`;
}

function chooseVariant(variants: string[], split: Record<string, number>) {
  if (!variants.length) return "A";
  const total = variants.reduce((sum, variant) => sum + Math.max(0, Number(split?.[variant] ?? 0)), 0);
  if (total <= 0) return variants[Math.floor(Math.random() * variants.length)] || variants[0];
  let cursor = Math.random() * total;
  for (const variant of variants) {
    cursor -= Math.max(0, Number(split?.[variant] ?? 0));
    if (cursor <= 0) return variant;
  }
  return variants[variants.length - 1];
}

export default function ExperimentProvider() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/experiments/active?path=${encodeURIComponent(pathname)}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (cancelled || !data?.experiment) return;
        const experiment = data.experiment;
        const assignments = readAssignments();
        const key = String(experiment.id);
        let variant = assignments[key];
        const variants = Array.isArray(experiment.variants) ? experiment.variants.map(String) : Object.keys(experiment.variants || {});
        let newlyAssigned = false;
        if (!variant || !variants.includes(variant)) {
          variant = chooseVariant(variants, experiment.trafficSplit || {});
          assignments[key] = variant;
          writeAssignments(assignments);
          newlyAssigned = true;
        }
        if (newlyAssigned) {
          fetch(`${API_BASE}/api/experiments/exposure`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            keepalive: true,
            body: JSON.stringify({ experimentId: key, variant, visitorId: getVisitorId(), path: pathname }),
          }).catch(() => undefined);
        }
        try {
          window.clarity?.("set", `experiment_${key}`, variant);
          window.clarity?.("set", "experiment_variant", `${experiment.name}:${variant}`);
        } catch {}
        document.documentElement.dataset.experiment = `${key}:${variant}`;
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [pathname]);

  return null;
}
