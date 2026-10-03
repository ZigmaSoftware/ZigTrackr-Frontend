# ZigTrackr frontend

React/Vite frontend for the ZigTrackr API. This directory is intended to be
its own Git repository; `.env`, `node_modules/`, and `dist/` are ignored.

```bash
npm ci
npm run dev
npm run lint
npm run test
npm run build
```

For production, serve `dist/` over HTTPS on the same browser origin as the
backend's `/api/` route. If a different API origin is required, set
`VITE_API_ROOT` at build time and configure Django CORS/CSRF origins and cookie
settings accordingly. The browser never connects directly to Redis.
