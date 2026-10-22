// Runs in the browser before the app hydrates (Next.js instrumentation-client).
// Fix for the Next.js 16 + Turbopack "negative time stamp" error thrown by performance.measure.
// It lives here instead of a <script> in app/layout.tsx: React 19 never executes <script> tags it
// renders and logs "Encountered a script tag while rendering React component".
if (typeof window !== "undefined" && window.performance && typeof window.performance.measure === "function") {
  const originalMeasure = window.performance.measure.bind(window.performance);
  window.performance.measure = ((...args: Parameters<Performance["measure"]>) => {
    try {
      return originalMeasure(...args);
    } catch (error) {
      if (error instanceof Error && error.message.includes("negative time stamp")) return undefined as unknown as PerformanceMeasure;
      throw error;
    }
  }) as Performance["measure"];
}

// Monitoring is opt-in. The rrweb recorder is a separate feature and is never added to Sentry.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  void import('./lib/sentry-client').catch(() => {});
}
export function onRouterTransitionStart(...args:Parameters<typeof import('@sentry/nextjs').captureRouterTransitionStart>) {
  if(process.env.NEXT_PUBLIC_SENTRY_DSN)void import('@sentry/nextjs').then(Sentry=>Sentry.captureRouterTransitionStart(...args)).catch(() => {});
}
