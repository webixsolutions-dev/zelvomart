import type { Instrumentation } from "next";
import { monitoringEnabled } from "@zelvomart/monitoring";
export async function register() {
  if (!monitoringEnabled(process.env.SENTRY_DSN)) return;
  if (process.env.NEXT_RUNTIME === "nodejs")
    await import("./sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");
}
export const onRequestError: Instrumentation.onRequestError = async (
  ...args
) => {
  if (!monitoringEnabled(process.env.SENTRY_DSN)) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
