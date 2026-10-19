export const MAX_BACKLOG_AGE_MS = 7 * 86400000;
export function expiredBacklog(createdAt: Date, now = Date.now()) {
  return createdAt.getTime() < now - MAX_BACKLOG_AGE_MS;
}
export function assertWorkerDatabase(connection: string | undefined) {
  if (!connection) throw new Error('Configure WORKER_DATABASE_URL using a session/direct PostgreSQL connection on port 5432.');
  const url = new URL(connection);
  if (url.port === '6543' || /[?&]pgbouncer=true(?:&|$)/i.test(url.search)) throw new Error('The worker cannot use the transaction pooler (6543). Use the session/direct connection on 5432.');
}
