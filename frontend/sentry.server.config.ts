import { initSentryServer } from "./lib/sentry-server";
import { httpIntegration } from "@sentry/nextjs";
initSentryServer(
  "frontend",
  httpIntegration({ sessions: false, disableIncomingRequestSpans: true }),
);
