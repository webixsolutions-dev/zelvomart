# Zelvomart Frontend

Next.js UI only. It contains no database client and no private backend secrets.

Setup:

```bat
copy .env.example .env.local
npm install
npm run dev
```

Required connection:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
BACKEND_URL=http://localhost:4000
```

Production points both variables to the deployed backend API URL.
