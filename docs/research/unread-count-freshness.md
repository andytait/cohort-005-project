# Unread count freshness: what each option costs

Research for [#8](https://github.com/andytait/cohort-005-project/issues/8) (map [#3](https://github.com/andytait/cohort-005-project/issues/3)). Facts only, no recommendation. Researched 2026-11-11.

Question: how should the in-app Notification unread count stay fresh? Options: (a) recompute in the layout loader on navigation and revalidation, (b) client polling, (c) SSE from a resource route. Costs covered: load, complexity, hosting.

## Stack as it stands

- **React Router is v8, not v7.** `package.json` pins `react-router`, `@react-router/node`, `@react-router/serve` and `@react-router/dev` at `8.3.0`. The installed copy is also 8.3.0 (`node_modules/react-router/package.json`). Every doc cited below is the v8 doc shipped in `node_modules/react-router/docs/`.
- Framework mode with SSR on (`react-router.config.ts`: `ssr: true`). No `shouldRevalidate`, `useRevalidator` or `text/event-stream` anywhere in `app/`.
- Every signed-in page sits under the `routes/layout.app.tsx` layout (`app/routes.ts`). Its loader (`app/routes/layout.app.tsx:174`) already feeds the `Sidebar`, which is where a badge would live.
- That loader already runs up to about 29 synchronous SQLite queries per call. That is 3 fixed queries, up to 2 for `isTeamAdmin`, and 8 per recent course for up to 3 courses (`getCourseLessonIds` is 2 queries and is called 3 times per course, at `:51`, `:69`, `:131` and `:150`).
- DB: one `better-sqlite3` connection to the file `data.db`, WAL mode on (`app/db/index.ts:13-14`). better-sqlite3's API is synchronous by design ([README](https://github.com/WiseLibs/better-sqlite3)), so every query runs on the Node event loop.
- Production server: `react-router-serve` (`package.json` `start`). It is one Express process with `compression()` mounted (`node_modules/@react-router/serve/dist/cli.js:111-127`), served over plain `app.listen`, so HTTP/1.1 unless a proxy in front speaks HTTP/2. The repo has no deployment config.
- Auth is a cookie session (`app/lib/session.ts:17`). Any same-origin request, `EventSource` included, sends it.

## React Router v8 facts that decide the cost

1. **In framework mode with SSR, every loader on the page reruns on every navigation and form submission.** From `docs/start/framework/route-module.md:487`: "route loaders are automatically revalidated after all navigations and form submissions (this is different from Data Mode)". The code agrees. `singleFetchLoaderNavigationStrategy` passes `defaultShouldRevalidate = true` unless the action returned 4xx/5xx (`dist/development/lib/dom/ssr/single-fetch.js:135`). So the layout loader already runs on every client navigation today.
2. **Opt out per route with `shouldRevalidate`** (`route-module.md:489-499`). If any route opts out, the client asks only for the routes still loading, via `?_routes=` on the single `.data` request (`single-fetch.js:175`, `:239`).
3. **All loaders go in one HTTP request** (single fetch, `<path>.data`). The server runs them as one request (`single-fetch.js:228-240`).
4. **`useRevalidator().revalidate()` reruns every loader on the current page.** That means the layout loader plus the leaf loader (for example the lesson page loader at `app/routes/courses.$slug.lessons.$lessonId.tsx:691`). Its JSDoc names "Window focus or polling on an interval" as the intended use (`dist/development/lib/hooks.d.ts:540-577`). It interrupts any active loads first (`lib/router/router.js:473-488`). It sets `state.revalidation`, not `navigation.state`, so the existing `NavigationLoadingBar` (`app/root.tsx:58`) does not flash on a poll.
5. **`fetcher.load(href)` loads one route only.** `singleFetchLoaderFetcherStrategy` requests just that route id (`single-fetch.js:210-218`). Loaded fetchers also revalidate after actions and after `useRevalidator` calls (`docs/how-to/optimize-revalidation.md:12`).
6. **A resource route** is a module with a `loader` and no default export, and it can return any `Response` (`docs/how-to/resource-routes.md:16-39`).
7. **SSE passes through the stock server.** `@react-router/express` calls `res.flushHeaders()` when `Content-Type` matches `text/event-stream` (`@react-router/express/dist/index.js:63`). `writeReadableStreamToWritable` calls `flush()` after every chunk (`@react-router/node/dist/index.js:121`), and `compression` exposes that flush (`compression/index.js:92-95`). So gzip does not hold events back. On client disconnect, `res.on("close")` aborts `request.signal` (`@react-router/express/dist/index.js:47`). That signal is the hook for cleaning up a stream.

## Option (a): recompute in the layout loader

- **Load:** one more query per navigation, on top of the roughly 29 already there. No traffic while the user sits on a page.
- **Freshness:** changes on every navigation and after every `<Form>` or fetcher action (fact 1). It never changes while the user stays on one page, for example watching a lesson video.
- **Complexity:** lowest. Same pattern as `isTeamAdmin`, no client code, works without JS (SSR).
- **Hosting:** nothing new.

## Option (b): client polling

Two ways to do it:

- **`useRevalidator` on an interval.** Each tick reruns the layout loader (roughly 29 queries plus the count) and the leaf loader (fact 4). Cost per tick is a full page data reload, times open tabs, times the interval.
- **`useFetcher().load("/api/unread-count")` on an interval** against a small resource route. Each tick runs one loader (fact 5): a session read and one count query. It also revalidates for free after actions.

Shared facts:

- **Load:** requests = open tabs ÷ interval. Each is a short HTTP request with no held connection. The query runs synchronously on the one Node process.
- **Background tabs:** browsers throttle timers in hidden tabs. Chrome checks them once a second, then once a minute after 5 minutes hidden; Firefox Android uses 15 minutes ([MDN setTimeout, "Timeouts in inactive tabs"](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout)). That cuts background load for free but makes background staleness vary by browser. Pausing on `document.visibilityState` is up to the app.
- **Complexity:** a small client hook (interval, visibility, cleanup). The fetcher variant also needs one resource route.
- **Hosting:** nothing new. Stateless, so it works behind any proxy.

## Option (c): SSE from a resource route

- **Mechanics:** a resource-route loader returns a `Response` whose body is a `ReadableStream` with `Content-Type: text/event-stream`. The stock server flushes each event (fact 7). The browser's `EventSource` reconnects on its own. The server can set the delay with the `retry:` field; the default is "implementation-defined… probably in the region of a few seconds" ([WHATWG HTML §9.2](https://html.spec.whatwg.org/multipage/server-sent-events.html)).
- **Where the "something changed" signal comes from:** SQLite has no LISTEN/NOTIFY. Two choices:
  - An in-process event emitter, fired by the code that inserts a Notification. This only works while the app is a single process. Today it is: one `react-router-serve` process and one SQLite file.
  - Server-side polling inside each stream. `PRAGMA data_version` is cheap but useless here: it "is unchanged for commits made on the same database connection" ([SQLite pragma docs](https://www.sqlite.org/pragma.html#pragma_data_version)), and the app has exactly one connection. So the stream would rerun the count query on a timer. That is option (b)'s load moved server-side, plus one held connection per tab.
- **Load:** one long-lived HTTP connection per open tab, held by the Node process. Idle cost is memory and a socket. Proxies can drop idle connections, so the spec suggests a `:` comment line "every 15 seconds or so" (WHATWG §9.2.7). That is a heartbeat write per tab every ~15s.
- **Browser connection cap:** over HTTP/1.1, SSE counts against a limit of 6 connections per browser per domain, across all tabs. Chrome and Firefox have marked this "Won't fix". Over HTTP/2 the stream limit is negotiated (default 100) ([MDN EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)). `react-router-serve` speaks HTTP/1.1 itself (see Stack). Without an HTTP/2 proxy in front, a user with 6 tabs open would block all further requests to the app from that browser, including normal navigations. WHATWG §9.2.7 notes the same problem and suggests a shared worker.
- **Complexity:** highest. You need: the stream, an emitter or server poll, heartbeat, cleanup on `request.signal` abort (fact 7), a client `EventSource` hook, reconnect handling, and wiring the count into the Sidebar outside loader data.
- **Hosting:** needs a host and proxy that allow long-lived streamed responses without buffering or short idle timeouts. The in-process emitter also ties you to one process. That fits SQLite's own constraint anyway: in WAL mode "all processes using a database must be on the same host computer; WAL does not work over a network filesystem" ([SQLite WAL](https://www.sqlite.org/wal.html)). So horizontal scaling across machines is already ruled out by the DB, not by SSE.

## Side by side

| | (a) Layout loader | (b) Poll: fetcher + resource route | (b) Poll: `useRevalidator` | (c) SSE |
|---|---|---|---|---|
| Staleness while idle on a page | Until next navigation or action | ≤ interval (foreground) | ≤ interval (foreground) | ~instant (emitter) or ≤ server poll interval |
| Server work per update | +1 query on a navigation that already happens | 1 short request, 1 count query | Full page data reload (≈29+ queries + leaf loader) | 1 event write; plus heartbeat every ~15s |
| Held connections | 0 | 0 | 0 | 1 per open tab |
| HTTP/1.1 6-connection cap | n/a | n/a | n/a | Applies unless HTTP/2 in front |
| New code | One query in existing loader | Resource route + client hook | Client hook | Resource route stream, emitter or poll, heartbeat, abort cleanup, client hook |
| Works without JS | Yes | No (falls back to (a) if combined) | No | No |
| Multi-process safe | Yes | Yes | Yes | Only with server-side DB polling; emitter is per-process |

(a) and either (b) variant stack: the loader gives the count on first render and navigation, the poll covers idle time.

## Open points the research can't settle

- How fresh the count must be is a product call, not a technical one. Is "on next navigation" enough, or must it tick while a Student watches a video?
- Production hosting target and whether HTTP/2 terminates in front. Neither is in the repo; they decide whether SSE's 6-connection cap bites.
- The Notification table's shape (#3) decides the count query's cost. An index on the recipient plus read state would make it an index-only count.
