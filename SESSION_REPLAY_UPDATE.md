# Zelvomart Session Replay update

- Added privacy-masked rrweb customer session recording on storefront pages only.
- Recorder never runs under `/admin`.
- All form inputs are masked before replay events are sent.
- Canvas recording and cross-origin iframe recording remain disabled.
- Added chunked replay ingestion endpoints and Prisma `SessionReplay` / `SessionReplayChunk` models.
- Orders and tracked funnel events now keep `replaySessionId` so sessions can be tied to conversion outcomes.
- Added Admin → Session Replays with source/outcome filters and a replay viewer.
- Added PageView/ViewContent/AddToCart/InitiateCheckout/Purchase markers to replay detail.
- Added session replay disclosure to the fallback Privacy Policy.

## Deployment

1. Run `npm install` from the repository root so `@rrweb/record` and `@rrweb/replay` are installed.
2. Apply the Prisma schema change once: `npm run db:push`.
3. Redeploy backend and frontend.
4. Frontend env: `NEXT_PUBLIC_SESSION_REPLAY_ENABLED=true` (set to `false` to disable recording).
5. Recommended: retain replay data only as long as operationally needed (for example 30 days) and update the live Privacy Policy if its database version overrides the fallback copy.
