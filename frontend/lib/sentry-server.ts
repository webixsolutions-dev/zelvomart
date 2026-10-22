import * as Sentry from "@sentry/nextjs";
import { monitoringEnabled, scrubMonitoringEvent } from "@zelvomart/monitoring";
export function initSentryServer(service: "frontend" | "frontend-edge") {
  if (!monitoringEnabled(process.env.SENTRY_DSN)) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
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
    initialScope: { tags: { service } },
  });
}
