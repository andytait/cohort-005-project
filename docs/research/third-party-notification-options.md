# Third-party notification inbox and toast options

Research for [#9](https://github.com/andytait/cohort-005-project/issues/9), part of map [#3](https://github.com/andytait/cohort-005-project/issues/3). Researched 2026-11-11. Facts only; prices are as shown on vendor pages on that date.

## What the app already has

- **React Router is 8.3.0, not 7.** `react-router`, `@react-router/node`, `@react-router/serve` and `@react-router/dev` are all pinned to `8.3.0` (`package.json`). Framework mode with `ssr: true` (`react-router.config.ts:6`). Served by `react-router-serve` (Node).
- **Toasts: `sonner` ^2.0.3** (`package.json:43`). One `<Toaster position="bottom-right" richColors closeButton />` mounted in `app/routes/layout.app.tsx:247`. Used in 9+ route/component files, all for action feedback after a `fetcher` returns (e.g. `app/routes/admin.users.tsx:193`, `app/components/comment-thread.tsx:67`). No toast is triggered by a server push today.
- **No real-time transport.** No `EventSource`, `text/event-stream` or WebSocket code in `app/`.
- **No mailer.** Map #3 lists `app/lib/mailer.server.ts`, but that file does not exist and nothing in `app/` imports a mailer. No email dependency in `package.json`.
- **Storage:** SQLite via `better-sqlite3` ^12.8.0 and `drizzle-orm` ^0.45.2.

## Hosted services

All five are "notification infrastructure": you call their API from the server to trigger a workflow, they store the message and deliver it to an in-app feed (and other channels). The in-app inbox data lives on the vendor's servers; the app's SQLite only holds whatever you choose to mirror.

| | Free tier | Paid entry | Self-host | React inbox package | Toasts | Email channel |
|---|---|---|---|---|---|---|
| **Knock** | 10,000 messages/month | Starter $250/month incl. 50,000, then $0.005 each | Not mentioned on pricing page | `@knocklabs/react` (MIT) | Doc recipe with `react-hot-toast` | Yes, "unlimited delivery channels" on all plans |
| **Novu** | 10,000 workflow runs/month, 5 workflows, 24h activity retention | Pro from $30/month (30,000+ runs), $1.20 per extra 1,000 | Enterprise plan for supported self-host; community edition exists but lacks "Inbox features" | `@novu/react` `<Inbox />` | Not covered in docs read | Yes, all channels on Free |
| **MagicBell** | Builder: 1,000 deliveries/month | Startup $249/month incl. 50,000, then $0.0025 each | Not mentioned | `@magicbell/react` (`Inbox`, `FloatingInbox`) | Built in (`ContextProvider` `toasts` prop, default `true`) | Yes |
| **Courier** | Developer: 10,000 sends/month | Business $0.005 per send, pay as you go | Not mentioned | `@trycourier/courier-react` v9 (`CourierInbox`) | Part of same SDK | Yes |
| **SuprSend** | 10,000 notifications/month, in-app feed with SuprSend branding | Essentials $100/month (50,000), then $2 per 1,000 | Enterprise only ("Self-hosted deployment") | `suprsend-react-inbox` (MIT) | Not checked | Yes, "unlimited channels" |

### Knock

- Pricing: Free up to 10,000 messages/month; Starter $250/month with 50,000 then $0.005 each; Enterprise custom. All plans list unlimited delivery channels, including email and in-app feed/toasts. ([pricing](https://knock.app/pricing))
- React: `@knocklabs/react` gives `NotificationFeedPopover`, `NotificationFeed`, `NotificationIconButton`. ([docs](https://docs.knock.app/in-app-ui/react/overview)) Repo `knocklabs/javascript` is MIT.
- Toasts: docs recipe subscribes `feedClient.on("items.received.realtime", ...)` and renders with `react-hot-toast`'s `toast.custom`. Swapping in `sonner` is not documented but the pattern is library-agnostic. ([toasts](https://docs.knock.app/in-app-ui/react/toasts))
- Auth: "enhanced security mode" requires a server-signed RS256 JWT with `sub` = user id, passed via `userToken` on `KnockProvider`; "Knock will reject requests from the client using your public API key that do not include a signed user token". ([security](https://docs.knock.app/in-app-ui/security-and-authentication))
- Data residency: no Knock doc found stating an EU region.

### Novu

- Pricing: Free 10,000 workflow runs/month, 2 environments, 3 team members, "All channels: Email, In-app, SMS, Chat, Push". Pro from $30/month, Team from $250/month, extra runs $1.20 per 1,000. Self-hosted listed under Enterprise. ([pricing](https://novu.co/pricing))
- Licence: repo `novuhq/novu` is MIT except `enterprise/packages`, which is under a proprietary licence ("solely for your internal operations", "prior written approval"). ([LICENSE](https://github.com/novuhq/novu/blob/next/LICENSE-MIT), `EE-PACKAGES-LICENSE`)
- Self-host requirements: API, Worker, WS services and Dashboard, plus MongoDB, Redis (AOF) and S3-compatible storage; single-VM minimum 4 vCPU / 8 GB plus MongoDB and Redis. The docs say the community edition differs from Cloud "including Inbox features, email activity tracking, SSO, RBAC, and compliance certifications". ([self-hosting](https://docs.novu.co/community/self-hosting-novu/overview)) Exactly which Inbox features are missing was not stated on that page.
- React: `@novu/react` `<Inbox />` with `applicationIdentifier` and `subscriberId`; unknown `subscriberId`s are auto-created. ([quickstart](https://docs.novu.co/platform/quickstart/react)) Production needs HMAC `subscriberHash` computed server-side, otherwise another user's id could be guessed. EU region via `apiUrl="https://eu.api.novu.co"` and `socketUrl="wss://eu.socket.novu.co"`. ([prepare for production](https://docs.novu.co/platform/inbox/prepare-for-production))

### MagicBell

- Pricing: Builder $0, 1,000 deliveries/month, 1 project; Startup $249/month, 50,000 deliveries, $0.0025 each after; Enterprise custom. ([pricing](https://www.magicbell.com/pricing))
- React: `@magicbell/react` with `Inbox`, `FloatingInbox`, `UserPreferences`; toasts are on by default via `ContextProvider`'s `toasts` prop. Auth by a User JWT generated on your server. ([docs](https://www.magicbell.com/docs/libraries/react))
- Self-host and data residency: not mentioned on the pages read.

### Courier

- Pricing: Developer free up to 10,000 sends/month; Business $0.005 per send; Enterprise custom. The page does not say which plans include Inbox. ([pricing](https://www.courier.com/pricing))
- React: `@trycourier/courier-react` v9 (React 18+) with `CourierInbox`; toasts are part of the same SDK. Backend issues a JWT, client calls `signIn({ userId, jwt })`. Older `@trycourier/react-inbox` packages are deprecated. ([inbox overview](https://www.courier.com/docs/platform/inbox/inbox-overview))
- Data residency: separate EU datacenter in Ireland on paid plans (Business, Enterprise), API at `https://api.eu.courier.com`. ([EU datacenter](https://www.courier.com/docs/platform/workspaces/eu-datacenter.md))

### SuprSend

- Pricing: Free 10,000 notifications/month (in-app feed carries SuprSend branding, 30-day log retention); Essentials $100/month (50,000, then $2 per 1,000); Business $250/month (50,000, then $5 per 1,000, adds batching/digest and user preferences); Enterprise custom. Self-hosted and BYO cloud (beta) are Enterprise only. ([pricing](https://www.suprsend.com/pricing))
- React: `suprsend-react-inbox` repo is MIT.
- Note: digests and user preferences (both open questions on map #3) are Business tier and above.

## Self-hostable and plain libraries

These keep notification data in the app's own SQLite. You build the inbox UI and the storage; the library covers only transport or toasts.

| Option | What it covers | Licence | Notes |
|---|---|---|---|
| `sonner` (already installed) | Toasts | MIT | Imperative `toast()` API; needs something to trigger it on push |
| `react-hot-toast` | Toasts | MIT | Used in Knock's toast recipe |
| `react-toastify` | Toasts | MIT | Alternative toast library |
| `remix-utils` v10.0.1 | SSE: `eventStream` (server, `remix-utils/sse/server`) and `useEventSource` (client, `remix-utils/sse/react`) | MIT | Peer dep `react-router ^8.0.0`. `eventStream` "must live in a Resource Route" ([README](https://github.com/sergiodxa/remix-utils#server-sent-events)) |
| Novu community edition | Full notification engine | MIT core | Needs MongoDB + Redis + S3; Inbox features limited vs Cloud (see above) |

- Drizzle + SQLite inbox: a `notifications` table, a loader for the list and unread count, and `fetcher` actions for mark-read, using the patterns the app already uses for comments. Live updates either by polling (`useRevalidator`) or SSE via `remix-utils`. Toasts fire from `sonner` on the client when new rows arrive.
- Email later: this path has no email channel; a sender (e.g. an SMTP or email API library) would be added separately. The hosted services above all include email in the same workflow.

## React Router SSR fit (all hosted SDKs)

- None of the vendor React docs read (Knock, Novu, MagicBell, Courier) mention server-side rendering or React Router. Their components open a browser connection (WebSocket for Novu, per its `wss://` `socketUrl`; Knock calls it a "real-time stream").
- React Router framework mode offers `.client` modules to keep browser-only code out of the server bundle; their exports are `undefined` on the server, so they can only be used in `useEffect` or event handlers. ([client modules](https://github.com/remix-run/react-router/blob/main/docs/api/framework-conventions/client-modules.md))
- Every hosted option needs a server-side secret step (Knock signed JWT, Novu HMAC hash, MagicBell/Courier user JWT). In this app that fits naturally in a loader on `layout.app.tsx`, which already resolves the current user.
- The inbox would render empty on the server and fill on hydration, unless the app also mirrors data locally.

## Unverified

- Knock, MagicBell and SuprSend data residency (no first-party page found).
- Whether Courier's free tier includes Inbox.
- Exact Inbox features missing from Novu's community self-hosted edition.
