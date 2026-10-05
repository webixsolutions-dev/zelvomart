# rrweb / Turbopack build fix

The rrweb replay stylesheet is no longer loaded through a CSS `@import` inside `app/globals.css`.
Tailwind/PostCSS was trying to resolve that package import while evaluating `globals.css` and Turbopack failed before the app could build.

The stylesheet is now imported from the Next.js root app entry (`app/layout.tsx`):

```ts
import "@rrweb/replay/dist/style.css";
```

After extracting a fresh copy, install the updated frontend dependencies before building:

```bat
npm install
npm run build --workspace frontend
```

Or from the `frontend` folder:

```bat
npm install
npm run build
```

Both `@rrweb/record` and `@rrweb/replay` are declared in `frontend/package.json`.
