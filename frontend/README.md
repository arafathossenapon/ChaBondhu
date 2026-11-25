# ChaBondhu frontend

From this directory run `pnpm install --frozen-lockfile`, copy `.env.example` to `.env.local`, then run `pnpm dev`. Set the public `VITE_API_BASE_URL` to the NestJS API URL or to a same-origin proxy prefix. Start NestJS separately for live integration. For direct browser requests, the backend's existing CORS configuration must allow the frontend origin, including its exact scheme and port. Include bearer and idempotency headers in any proxy or CORS allowlist. Private settings belong on the backend.

`pnpm build` checks TypeScript and writes `dist/`. A static host must serve `index.html` for frontend route deep links.

Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, and `pnpm test:browser`. The browser suite uses Playwright Chromium by default (`pnpm exec playwright install chromium`), or set `PLAYWRIGHT_BROWSER_CHANNEL=msedge` to use installed Edge. The browser suite starts its own Vite server.

The landing page is public. Sign-in and registration currently render route placeholders. Feature modules, real session state, profile forms and role-specific workflows follow in subsequent milestones. The [architecture plan](../docs/frontend-architecture-plan.md) defines those boundaries.
