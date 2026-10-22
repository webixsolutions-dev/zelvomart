/** Deliberately returns only a privacy-safe subset of the supplied SDK event. */
export function scrubMonitoringEvent<T extends object>(
  event: T,
  hint?: { attachments?: unknown[] },
): T | null;
export function monitoringEnabled(dsn: string | undefined): boolean;
