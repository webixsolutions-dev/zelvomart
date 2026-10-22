import * as Sentry from "@sentry/nextjs";
import { monitoringEnabled, scrubMonitoringEvent } from "@zelvomart/monitoring";
if (monitoringEnabled(process.env.NEXT_PUBLIC_SENTRY_DSN)) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
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
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend: scrubMonitoringEvent,
    beforeSendTransaction: () => null,
    initialScope: { tags: { service: "frontend" } },
  });
}
