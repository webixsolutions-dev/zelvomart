"use client";
import { useEffect } from "react";
export default function GlobalError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN)
      void import("@sentry/nextjs")
        .then((Sentry) => Sentry.captureException(error))
        .catch(() => {});
  }, [error]);
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui,sans-serif",
          background: "#f5f8fb",
          color: "#142943",
        }}
      >
        <main style={{ maxWidth: 480, margin: "15vh auto", padding: 24 }}>
          <title>Something went wrong | Zelvomart</title>
          <h1>Something went wrong</h1>
          <p>
            Please try again. If the problem continues, come back in a few
            minutes.
          </p>
          <button
            onClick={() => (retry || reset)()}
            style={{
              padding: "12px 20px",
              border: 0,
              borderRadius: 8,
              background: "#2463eb",
              color: "white",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <p>
            <a href="/">Back to the store</a>
          </p>
        </main>
      </body>
    </html>
  );
}
