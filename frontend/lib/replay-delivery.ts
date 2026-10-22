export type ReplayDeliveryResult = { ok: boolean; terminal?: boolean; registrationRequired?: boolean };

/** Short per-IP throttles are retryable; durable recording quotas end the current session. */
export function replayDeliveryResult(status: number, error?: string): ReplayDeliveryResult {
  return {
    ok: status >= 200 && status < 300,
    terminal: error === "REPLAY_SESSION_LIMIT" || error === "REPLAY_DAILY_START_LIMIT" || error === "REPLAY_STORAGE_NOT_CONFIGURED",
    registrationRequired: error === "REPLAY_SESSION_NOT_STARTED",
  };
}

/** Failed registration keeps a batch queued; a terminal limit stops the session without rotating its id. */
export function createReplayDelivery<T>(options: {
  register: () => Promise<ReplayDeliveryResult>;
  upload: (chunk: T, keepalive: boolean) => Promise<ReplayDeliveryResult>;
  stop: () => void;
}) {
  let ready = false;
  let registration: Promise<boolean> | undefined;
  let stopped = false;
  const observe = (result: ReplayDeliveryResult) => {
    if (result.terminal && !stopped) {
      stopped = true;
      options.stop();
    }
    if (result.registrationRequired) ready = false;
    return result.ok;
  };
  const register = async () => {
    if (stopped) return false;
    if (ready) return true;
    if (!registration) registration = options.register().then((result) => {
      ready = observe(result);
      return ready;
    }).finally(() => { registration = undefined; });
    return registration;
  };
  return {
    register,
    observe,
    get stopped() { return stopped; },
    async upload(chunk: T, keepalive = false) {
      if (!(await register()) || stopped) return false;
      return observe(await options.upload(chunk, keepalive));
    },
  };
}
