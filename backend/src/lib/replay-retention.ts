/**
 * Session replay files live in R2 bucket `zelvomart-replays` under `replays/`, and the bucket's lifecycle rule deletes
 * them 14 days after upload. The database rows (SessionReplay, and its chunks by cascade) must not outlive their files,
 * so retention is 14 days by default and never more than 14, whatever the admin setting or env variable says.
 */
export const REPLAY_FILE_LIFETIME_DAYS = 14;

/**
 * Days to keep replay metadata. The admin setting `tracking.sessionReplayRetentionDays` wins, then the env variable
 * `SESSION_REPLAY_RETENTION_DAYS`, then 14. A value above the file lifetime is cut to it; a missing, zero, negative or
 * non-number value falls through to the next source.
 */
export function replayRetentionDays(
  setting: unknown,
  envValue: unknown = process.env.SESSION_REPLAY_RETENTION_DAYS,
): number {
  for (const value of [setting, envValue]) {
    if (value === null || value === undefined || value === "") continue;
    const days = Math.floor(Number(value));
    if (Number.isFinite(days) && days > 0) return Math.min(days, REPLAY_FILE_LIFETIME_DAYS);
  }
  return REPLAY_FILE_LIFETIME_DAYS;
}

/** Replays that started before this moment are past retention. */
export function replayCutoff(days: number, now = Date.now()) {
  return new Date(now - days * 86_400_000);
}
