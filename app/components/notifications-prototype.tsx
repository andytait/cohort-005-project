// PROTOTYPE (wayfinder: "How does the Notification inbox look and behave,
// using Knock's feed components?"). Throwaway; lives on prototype/notification-inbox.
//
// Three variants, switch with ?variant=A|B|C or the floating bar (←/→ keys):
//   A  Knock stock: bell + NotificationFeedPopover, Knock's own styling, no toasts
//   B  Drawer: bell opens a right-hand slide-over (headless, our UI), sonner toasts
//   C  Page: "Notifications" nav item with count, /notifications page grouped by type
//
// Knock's components touch `window`, so everything mounts client-side only.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams, NavLink } from "react-router";
import { toast } from "sonner";
import {
  KnockProvider,
  KnockFeedProvider,
  NotificationIconButton,
  NotificationFeedPopover,
  useKnockFeed,
  type RenderItemProps,
} from "@knocklabs/react";
import type { FeedItem } from "@knocklabs/client";
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { cn } from "~/lib/utils";
import type { KnockPrototypeConfig } from "~/lib/knock.prototype.server";
import "@knocklabs/react/dist/index.css";

export const VARIANTS = ["A", "B", "C"] as const;
export type Variant = (typeof VARIANTS)[number];
const VARIANT_NAMES: Record<Variant, string> = {
  A: "Knock stock popover",
  B: "Drawer + toasts",
  C: "Inbox page",
};

type NotificationData = {
  type:
    | "discussion-reply-to-my-question"
    | "discussion-reply-in-joined-thread"
    | "discussion-question-on-my-course"
    | "refund-request-decided";
  courseTitle: string;
  lessonTitle?: string;
  authorName?: string;
  authorRole?: string;
  refundOutcome?: "approved" | "declined";
  url: string;
};
type Item = FeedItem<NotificationData>;

export function describe(d: NotificationData | null): {
  title: string;
  detail: string;
} {
  if (!d) return { title: "Notification", detail: "" };
  const who =
    d.authorRole === "Instructor"
      ? `${d.authorName} (Instructor)`
      : d.authorName;
  switch (d.type) {
    case "discussion-reply-to-my-question":
      return {
        title: `${who} replied to your question`,
        detail: `${d.lessonTitle} · ${d.courseTitle}`,
      };
    case "discussion-reply-in-joined-thread":
      return {
        title: `${who} replied in a thread you're in`,
        detail: `${d.lessonTitle} · ${d.courseTitle}`,
      };
    case "discussion-question-on-my-course":
      return {
        title: `${who} asked a question`,
        detail: `${d.lessonTitle} · ${d.courseTitle}`,
      };
    case "refund-request-decided":
      return {
        title: `Your refund request was ${d.refundOutcome}`,
        detail: d.courseTitle,
      };
  }
}

function ago(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

// ── variant persistence: ?variant= wins, sessionStorage keeps it across navigation
export function useVariant(): [Variant, (v: Variant) => void] {
  const [params, setParams] = useSearchParams();
  const [stored, setStored] = useState<Variant>("A");
  useEffect(() => {
    try {
      const s = sessionStorage.getItem("notif-variant") as Variant | null;
      if (s && VARIANTS.includes(s)) setStored(s);
    } catch {}
  }, []);
  const fromUrl = params.get("variant") as Variant | null;
  const current = fromUrl && VARIANTS.includes(fromUrl) ? fromUrl : stored;
  useEffect(() => {
    try {
      sessionStorage.setItem("notif-variant", current);
    } catch {}
  }, [current]);
  return [
    current,
    (v) => {
      setStored(v);
      const next = new URLSearchParams(params);
      next.set("variant", v);
      setParams(next, { replace: true });
    },
  ];
}

function useClientOnly() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}

export function NotificationsProvider({
  config,
  children,
}: {
  config: KnockPrototypeConfig | null;
  children: ReactNode;
}) {
  const ready = useClientOnly();
  if (!ready || !config) return <>{children}</>;
  return (
    <KnockProvider
      apiKey={config.publicKey}
      user={{ id: config.userId }}
      userToken={config.userToken}
    >
      <KnockFeedProvider feedId={config.feedChannelId}>
        {children}
      </KnockFeedProvider>
    </KnockProvider>
  );
}

function useHasKnock() {
  try {
    useKnockFeed();
    return true;
  } catch {
    return false;
  }
}

function useFeed() {
  const { feedClient, useFeedStore } = useKnockFeed();
  const items = useFeedStore((s) => s.items) as Item[];
  const meta = useFeedStore((s) => s.metadata);
  const loading = useFeedStore((s) => s.loading);
  useEffect(() => {
    feedClient.fetch();
  }, [feedClient]);
  return { feedClient, items, unread: meta.unread_count, loading };
}

function useOpenItem() {
  const navigate = useNavigate();
  const { feedClient } = useKnockFeed();
  return (item: Item) => {
    feedClient.markAsRead(item);
    if (item.data?.url) navigate(item.data.url);
  };
}

// ── Sidebar header slot (A and B put the bell here)
export function SidebarBellSlot() {
  const ready = useClientOnly();
  const [variant] = useVariant();
  const hasKnock = useHasKnock();
  if (!ready || !hasKnock) return null;
  if (variant === "A") return <StockBell />;
  if (variant === "B") return <DrawerBell />;
  return null;
}

// ── Sidebar nav slot (C puts a nav item here)
export function SidebarNavSlot() {
  const ready = useClientOnly();
  const [variant] = useVariant();
  const hasKnock = useHasKnock();
  if (!ready || !hasKnock || variant !== "C") return null;
  return <InboxNavItem />;
}

// ── A: Knock stock
function StockBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const openItem = useOpenItem();
  return (
    <>
      <NotificationIconButton ref={ref} onClick={() => setOpen(!open)} />
      <NotificationFeedPopover
        buttonRef={ref}
        isVisible={open}
        onClose={() => setOpen(false)}
        placement="right-start"
        onNotificationClick={(item) => {
          setOpen(false);
          openItem(item as Item);
        }}
        renderItem={({ item, onItemClick }: RenderItemProps) => {
          const i = item as Item;
          const { title, detail } = describe(i.data);
          return (
            <button
              key={i.id}
              onClick={() => onItemClick?.(i)}
              className="flex w-full gap-3 border-b px-4 py-3 text-left hover:bg-black/5"
            >
              <span
                className={cn(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  i.read_at ? "bg-transparent" : "bg-blue-600"
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{title}</span>
                <span className="block truncate text-xs opacity-60">
                  {detail}
                </span>
              </span>
              <span className="text-xs opacity-50">{ago(i.inserted_at)}</span>
            </button>
          );
        }}
      />
    </>
  );
}

// ── B: drawer + sonner toasts
function DrawerBell() {
  const [open, setOpen] = useState(false);
  const { feedClient, items, unread } = useFeed();
  const openItem = useOpenItem();
  const [tab, setTab] = useState<"unread" | "all">("unread");

  useEffect(() => {
    const onNew = ({ items }: { items: Item[] }) => {
      for (const i of items) {
        const { title, detail } = describe(i.data);
        toast(title, {
          description: detail,
          icon: <BellRing className="size-4" />,
          action: { label: "View", onClick: () => openItem(i) },
        });
      }
    };
    feedClient.on("items.received.realtime", onNew as never);
    return () => feedClient.off("items.received.realtime", onNew as never);
  }, [feedClient]);

  const shown = tab === "unread" ? items.filter((i) => !i.read_at) : items;
  const byCourse = groupBy(shown, (i) => i.data?.courseTitle ?? "Other");

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent"
        title="Notifications"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-[11px] font-semibold leading-5 text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/30"
          onClick={() => setOpen(false)}
        >
          <aside
            className="flex h-full w-[26rem] flex-col bg-background text-foreground shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center gap-2 border-b px-5 py-4">
              <h2 className="flex-1 text-lg font-semibold">Notifications</h2>
              <button
                onClick={() => feedClient.markAllAsRead()}
                disabled={unread === 0}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-muted disabled:opacity-40"
              >
                <CheckCheck className="size-4" /> Mark all read
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </header>
            <div className="flex gap-1 border-b px-5 py-2 text-sm">
              {(["unread", "all"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "rounded-full px-3 py-1 capitalize",
                    tab === t
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  {t}
                  {t === "unread" && unread > 0 ? ` (${unread})` : ""}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto">
              {shown.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                  <CheckCheck className="size-8" />
                  <p className="text-sm">
                    {tab === "unread"
                      ? "You're all caught up."
                      : "Nothing here yet."}
                  </p>
                </div>
              )}
              {[...byCourse].map(([course, group]) => (
                <section key={course}>
                  <h3 className="sticky top-0 bg-muted/80 px-5 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                    {course}
                  </h3>
                  {group.map((i) => {
                    const { title, detail } = describe(i.data);
                    return (
                      <div
                        key={i.id}
                        className={cn(
                          "group flex items-start gap-3 border-b px-5 py-3",
                          !i.read_at && "bg-primary/5"
                        )}
                      >
                        <button
                          className="min-w-0 flex-1 text-left"
                          onClick={() => {
                            setOpen(false);
                            openItem(i);
                          }}
                        >
                          <span
                            className={cn(
                              "block text-sm",
                              !i.read_at && "font-semibold"
                            )}
                          >
                            {title}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {i.data?.lessonTitle ?? detail} ·{" "}
                            {ago(i.inserted_at)}
                          </span>
                        </button>
                        {!i.read_at && (
                          <button
                            title="Mark read"
                            onClick={() => feedClient.markAsRead(i)}
                            className="rounded p-1 text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100"
                          >
                            <Check className="size-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </section>
              ))}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

// ── C: nav item + page
function InboxNavItem() {
  const { unread } = useFeed();
  return (
    <NavLink
      to="/notifications"
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )
      }
    >
      <Bell className="size-4" />
      <span className="flex-1">Notifications</span>
      {unread > 0 && (
        <span className="rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground">
          {unread}
        </span>
      )}
    </NavLink>
  );
}

const SECTION_TITLES: Record<NotificationData["type"], string> = {
  "discussion-reply-to-my-question": "Replies to your questions",
  "discussion-reply-in-joined-thread": "Threads you're in",
  "discussion-question-on-my-course": "New questions on your courses",
  "refund-request-decided": "Refunds",
};

export function InboxPage() {
  const ready = useClientOnly();
  const hasKnock = useHasKnock();
  if (!ready) return null;
  if (!hasKnock)
    return (
      <p className="p-8 text-muted-foreground">
        Pick a user in the DevUI panel (and check KNOCK_* in .env).
      </p>
    );
  return <InboxPageInner />;
}

function InboxPageInner() {
  const { feedClient, items, unread, loading } = useFeed();
  const openItem = useOpenItem();
  const sections = groupBy(
    items,
    (i) => i.data?.type ?? "refund-request-decided"
  );
  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">{unread} unread</p>
        </div>
        <button
          onClick={() => feedClient.markAllAsRead()}
          disabled={unread === 0}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-40"
        >
          Mark all as read
        </button>
      </div>
      {!loading && items.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          No Notifications yet. Replies to your questions and refund decisions
          land here.
        </div>
      )}
      <div className="space-y-8">
        {[...sections].map(([type, group]) => (
          <section key={type}>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
              {SECTION_TITLES[type as NotificationData["type"]] ?? type}
            </h2>
            <ul className="divide-y rounded-lg border">
              {group.map((i) => {
                const { title, detail } = describe(i.data);
                return (
                  <li key={i.id}>
                    <button
                      onClick={() => openItem(i)}
                      className={cn(
                        "flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-muted/50",
                        i.read_at && "opacity-60"
                      )}
                    >
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          !i.read_at && "bg-primary"
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">
                          {title}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {detail}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {ago(i.inserted_at)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

// ── Floating switcher (dev only)
export function PrototypeSwitcher() {
  const [variant, setVariant] = useVariant();
  const ready = useClientOnly();
  const idx = VARIANTS.indexOf(variant);
  const go = (d: number) =>
    setVariant(VARIANTS[(idx + d + VARIANTS.length) % VARIANTS.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable]")) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!ready || import.meta.env.PROD) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-fuchsia-700 px-2 py-1.5 text-sm font-medium text-white shadow-lg ring-2 ring-white">
      <button
        onClick={() => go(-1)}
        className="rounded-full p-1 hover:bg-white/20"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-44 text-center">
        {variant} ({VARIANT_NAMES[variant]})
      </span>
      <button
        onClick={() => go(1)}
        className="rounded-full p-1 hover:bg-white/20"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

function groupBy<T, K>(xs: T[], key: (x: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
  return m;
}
