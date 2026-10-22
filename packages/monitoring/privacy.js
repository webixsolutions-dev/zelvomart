/** One allowlist for browser, edge and Node events. Free-form diagnostics may contain checkout/auth data. */
function safeFile(value) {
  if (typeof value !== "string") return undefined;
  const path = value.split(/[?#]/)[0].replace(/\\/g, "/");
  const marker = path.match(/\/(?:_next|src|app|node_modules)\//);
  const relative = marker ? path.slice(marker.index) : path.split("/").pop();
  if (
    !relative ||
    /@|%40|(?:bearer|token|secret|password)|\d{7,}/i.test(relative)
  )
    return "[source]";
  return relative.slice(0, 300);
}
function safeFrames(stack) {
  if (!stack || !Array.isArray(stack.frames)) return undefined;
  return {
    frames: stack.frames.slice(-80).map((frame) => ({
      filename: safeFile(frame.filename),
      function:
        typeof frame.function === "string" &&
        /^[\w.$<>\[\] -]{1,120}$/.test(frame.function)
          ? frame.function
          : undefined,
      lineno: Number.isInteger(frame.lineno) ? frame.lineno : undefined,
      colno: Number.isInteger(frame.colno) ? frame.colno : undefined,
      in_app: typeof frame.in_app === "boolean" ? frame.in_app : undefined,
    })),
  };
}
function scrubMonitoringEvent(event, hint) {
  // Attachments are sent outside the event payload; scrub them as well.
  if (hint) hint.attachments = [];
  if (!event || event.type) return null; // Error reporting only: no transactions, logs or replay events.
  const values = Array.isArray(event.exception?.values)
    ? event.exception.values
    : [];
  const trace = event.contexts?.trace;
  const clean = {
    event_id:
      typeof event.event_id === "string" &&
      /^[a-f\d]{32}$/i.test(event.event_id)
        ? event.event_id
        : undefined,
    timestamp:
      typeof event.timestamp === "number" ? event.timestamp : undefined,
    level: ["fatal", "error", "warning", "info", "debug"].includes(event.level)
      ? event.level
      : "error",
    platform: ["javascript", "node"].includes(event.platform)
      ? event.platform
      : "javascript",
    release:
      typeof event.release === "string" &&
      /^[a-f\d]{7,64}$/i.test(event.release)
        ? event.release
        : undefined,
    environment: ["production", "preview", "development", "test"].includes(
      event.environment,
    )
      ? event.environment
      : undefined,
    message: event.message
      ? "Application error (message omitted for privacy)"
      : undefined,
    exception: values.length
      ? {
          values: values.map((entry) => ({
            type:
              typeof entry.type === "string" &&
              /^(?:[A-Za-z]+Error|Error)$/.test(entry.type)
                ? entry.type
                : "Error",
            value: "Error details omitted for privacy",
            stacktrace: safeFrames(entry.stacktrace),
            mechanism: entry.mechanism
              ? {
                  type: /^[\w.]{1,80}$/.test(entry.mechanism.type || "")
                    ? entry.mechanism.type
                    : "generic",
                  handled: entry.mechanism.handled !== false,
                }
              : undefined,
          })),
        }
      : undefined,
    request:
      event.request &&
      /^(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)$/.test(
        event.request.method || "",
      )
        ? { method: event.request.method }
        : undefined,
    contexts:
      trace &&
      /^[a-f\d]{32}$/i.test(trace.trace_id || "") &&
      /^[a-f\d]{16}$/i.test(trace.span_id || "")
        ? { trace: { trace_id: trace.trace_id, span_id: trace.span_id } }
        : undefined,
    tags: {
      service: ["backend", "frontend", "frontend-edge"].includes(
        event.tags?.service,
      )
        ? event.tags.service
        : "application",
    },
  };
  if (Array.isArray(event.debug_meta?.images))
    clean.debug_meta = {
      images: event.debug_meta.images
        .filter(
          (image) =>
            image.type === "sourcemap" &&
            /^[a-f\d-]{36}$/i.test(image.debug_id || ""),
        )
        .map((image) => ({
          type: "sourcemap",
          code_file: safeFile(image.code_file),
          debug_id: image.debug_id,
        })),
    };
  return clean;
}
function monitoringEnabled(dsn) {
  if (!dsn || typeof dsn !== "string") return false;
  try {
    const url = new URL(dsn);
    return (
      url.protocol === "https:" &&
      /^[a-z\d]+$/i.test(url.username) &&
      !url.password &&
      !url.search &&
      !url.hash &&
      /^\/\d+$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}
exports.scrubMonitoringEvent = scrubMonitoringEvent;
exports.monitoringEnabled = monitoringEnabled;
// Session and client-report envelopes bypass beforeSend. Disable them at their
// source; Node callers also supply the Http integration with sessions:false.
function errorOnlyMonitoringOptions(httpIntegration) {
  return {
    tracesSampleRate: 0,
    sendClientReports: false,
    integrations: (defaults) =>
      defaults
        .filter(
          (integration) =>
            !["BrowserSession", "ProcessSession"].includes(integration.name),
        )
        .map((integration) =>
          integration.name === "Http" && httpIntegration
            ? httpIntegration
            : integration,
        ),
  };
}
exports.errorOnlyMonitoringOptions = errorOnlyMonitoringOptions;
