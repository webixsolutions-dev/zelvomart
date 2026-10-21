# Review system

The admin Reviews page supports CSV preview/import, a separate Imported Reviews view, manual entry, moderation, edits, recoverable batch deletion and import history/error CSVs. All imported reviews start Pending. Existing delivered-order verification remains required for customer submissions. Imported/private email alone never grants Verified Purchase.

## Deployment

1. Apply the additive migration before deploying the new backend:
   `npm run db:deploy --workspace backend` (from the repository root).
2. Deploy backend and frontend together. The backend already uses the S3/R2 environment variables documented in `.env.example`.
3. Add a bucket CORS rule allowing `PUT` and `GET` from the exact storefront/admin origins, with `Content-Type` in allowed headers. The browser sends ZIP files and review media directly to presigned R2 URLs; large files do not pass through Vercel request bodies. Authorisation lasts one hour, and final submissions validate ownership, actual object length, image/MP4 contents and per-review media counts on the server.
4. Optionally expire `review-staging/` objects with a bucket lifecycle rule after one day. Keep `reviews/assets/` objects: recoverable deletion intentionally retains media. Review media never enters the product gallery.
5. The backend requests a 300-second function duration for bulk processing. Ensure the deployed plan permits that duration. `STORE_TIMEZONE` defaults to `Asia/Karachi` for the future-calendar-date check.

CSV limits: 500 rows / 2 MB; ZIP: 40 MB compressed / 100 MB expanded; photos/avatar: JPEG, PNG or WebP, 5 MB each; up to five photos and one MP4 video (20 MB) per review. Start from **Download CSV Template**. One row is one review. Folder paths must belong to the row's exact reviewRef. Missing historical email is a visible warning; missing manual/customer email is an error. Calendar dates remain unchanged. A duplicate reference, including a soft-deleted reference, cannot be overwritten or recreated.

Deletion records the batch tombstone and audit event in a database transaction. Other batches, manual reviews and customer submissions remain untouched. Restoring a batch returns its reviews to Pending for approval. Individually deleted reviews are not restored with a later batch restoration.

## Verification

From the repository root:

```
npm run test:reviews --workspace backend
npm run test:reviews:integration --workspace backend
npm run build
```

The integration suite starts an in-memory PostgreSQL-compatible PGlite database and a fake local S3 endpoint on ports 55439–55441. It overrides database/storage/auth settings before loading the app, creates only clearly labelled synthetic QA records, and never connects to the configured/live database or R2 bucket. It exercises multi-product CSVs, original dates, photo/video/avatar ownership, direct staging and owner isolation, private public-API output, duplicate protection, manual entry, customer eligibility, moderation/ratings, error CSVs, retryable rows, isolated batch deletion, restoration and audit events. The small MP4 fixture is a generated blue frame, not customer feedback.
## Demo reviews and the redesigned inbox

Reviews now has a searchable product selector, accessible dropdowns, a modal add/edit form, star rating controls, media previews/removal, a live review preview, date filters, sorting, paging and bulk approval/rejection. Import preview keeps product corrections visible until you validate again. Failed saves leave the form intact and allow retry.

Use **Try a demo review** or **Fill demo details** to test manual entry. Demo records use the dedicated `TEST` origin (no schema migration is needed). They can be approved, rejected, edited and deleted in the admin, but both public product queries and public rating calculations explicitly exclude them. Existing demo reviews cannot be converted to genuine feedback. An existing customer review keeps its purchase-linked product; manual, imported and demo reviews can be reassigned to an existing product.

The edit API accepts staged media uploads, `retainMediaIds` and `removeAvatar`. It validates the combined retained/new media limits before changing associations and writes an audit event. Direct upload now falls back automatically to signed, owner-bound 2 MB same-origin chunks; the server assembles the original staged object and checks its exact length. This avoids browser CORS and serverless request-size limitations without granting anonymous storage access. R2 CORS configuration is optional for the fallback; valid R2 object read/write credentials are still required. Expiring `review-staging/` after one day also cleans up fallback chunks.
