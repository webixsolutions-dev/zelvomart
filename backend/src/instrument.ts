import "dotenv/config";
import { monitoringEnabled, scrubMonitoringEvent } from "@zelvomart/monitoring";
import type { Express } from "express";

// This side-effect module must load before Express/Prisma so the SDK can instrument their errors.
// With no DSN it does not load or initialise Sentry at all.
let sdk: typeof import("@sentry/node") | undefined;
if (monitoringEnabled(process.env.SENTRY_DSN)) {
  sdk = require("@sentry/node") as typeof import("@sentry/node");
  sdk.init({
    dsn: process.env.SENTRY_DSN,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      frameContextLines: 0,
    },

    beforeSendLog: () => null,
    beforeSendMetric: () => null,
    beforeSend: scrubMonitoringEvent,
    beforeSendTransaction: () => null,
    initialScope: { tags: { service: "backend" } },
  });
}
export function installErrorMonitoring(app: Express) {
  if (sdk) sdk.setupExpressErrorHandler(app);
}
export function reportError(error: unknown) {
  sdk?.captureException(error);
}
