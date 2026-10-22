# Batch 6 initial measurements

Measured on 23 October 2026 after Batch 5 production deployment checks succeeded. These are diagnostic
single runs, **not a passing acceptance result**. Every run hit Lighthouse's page-load timeout and warns
that results may be incomplete. Home/category collection overlapped briefly; run three sequential
samples per page before using a median to approve an optimization.

The production alias was serving Batch 5 (`4f8ebd8`) when collection started. Batch 5-B was merged during
the product collection and was still deploying; repeat against an immutable deployment URL for a final
comparison. The product is an existing example item, so this is not a final-catalog launch benchmark.

## Method and initial readings

Lighthouse 13.5.0, installed Chrome, mobile emulation, simulated Slow 4G: RTT 150 ms, throughput
1638.4 Kbps, CPU slowdown 4x. Browser cache/storage reset by Lighthouse. No throttling settings,
third-party scripts, tracking preferences or production configuration were changed for the audit.

| Page | LCP | TBT | CLS | Speed Index | Document server response | Simulated TTFB |
|---|---:|---:|---:|---:|---:|---:|
| Home | 2.90 s | 636 ms | 0 | 4.26 s | 81 ms | 898 ms |
| Beauty category | 3.17 s | 633 ms | 0 | 3.30 s | 82 ms | 686 ms |
| Example lipstick product | 2.98 s | 909 ms | 0 | 2.63 s | 73 ms | 673 ms |

Document server response is Lighthouse's `server-response-time` audit. Simulated TTFB includes its
modeled network connection/request latency; it is not interchangeable with backend execution time.
These cached document responses alone do not justify a speculative caching rewrite.

URLs and exact numeric values are in `performance/2026-10-23-baseline.json`. Original HTML/JSON reports
are retained locally in `tmp-lighthouse/`; they are ignored rather than committed because raw reports
contain third-party tracking parameters and full page/network details.

## Opportunities reported

| Page | First five opportunities with a displayed estimate |
|---|---|
| Home | Unused CSS 18 KiB; unused JS 157 KiB; cache lifetimes 240 KiB; image delivery 33 KiB; legacy JS 26 KiB |
| Category | Unused CSS 21 KiB; unused JS 179 KiB; cache lifetimes 240 KiB; image delivery 30 KiB; legacy JS 26 KiB |
| Product | Unused CSS 21 KiB; unused JS 175 KiB; cache lifetimes 240 KiB; legacy JS 26 KiB; no fifth quantified opportunity |

The home execution audit attributes substantial CPU time to the first-party framework chunk and to
Google/Meta scripts. Image discovery already confirms an eager, high-priority hero in the initial HTML.
Observed first load completes around 1.5 s, but navigation collection waits until the 45-second limit.
The home carousel changes visible content after first paint, so investigate stable visual completion
and continuing background work before comparing Speed Index. Do not remove useful CSS by looking at
one page, defer events until after shoppers leave, or disable recording to produce a better score.

## Remaining speed work

1. Complete the handover's manual configuration and use the final catalog/domain for launch acceptance.
2. Reproduce the load-timeout warning and collect three sequential runs per page against one immutable
   Mumbai deployment. Keep the same mobile network/CPU settings and retain complete reports.
3. Inspect trace long tasks and route chunks. Test a specific change to first-party hydration,
   navigation prefetch, or measured image delivery, then compare those same pages. Third-party cache
   headers are provider-controlled; do not claim their entire estimate as an application saving.
4. Preserve checkout, search, tracking event IDs/queues, privacy masks, recording and the existing UI.
   Run the required app checks and verify the affected flows before merging a performance change.
5. Acceptance remains: LCP <2.5 s, TBT <200 ms, CLS <0.1 and Speed Index <3.4 s. The readings above do
   **not** satisfy that set. No speed improvement is claimed and no speculative app changes were made.
