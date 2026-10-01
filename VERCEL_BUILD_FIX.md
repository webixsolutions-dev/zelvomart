# Vercel Prisma build fix

The Vercel failure was caused by the Prisma client not being generated from the Zelvomart schema before `next build` ran in the `frontend` workspace. That left `@prisma/client` without the project enums/models, which caused the large cascade of TypeScript errors (`OrderStatus`, `ProductStatus`, `Role`, `Prisma.OrderWhereInput`, implicit-any callbacks, etc.).

## Fix applied

- `frontend/package.json` now runs `prisma generate --schema=../backend/prisma/schema.prisma` before every production build.
- Prisma CLI is a frontend build-time devDependency and is aligned with `@prisma/client` 6.19.x.
- Prisma install scripts are explicitly approved for npm's install-script policy.
- Root `npm run build` delegates to the frontend build, avoiding duplicate generation.

## Vercel

Keep the Vercel Root Directory as `frontend` if it is already configured that way. Build command can remain `npm run build`.

Required environment variable in Vercel:

- `DATABASE_URL`

The application also needs the other production secrets from `.env.example` for the related integrations.
