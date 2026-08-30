import { auth } from "../auth";
import { firestore } from "../lib/firestore";
import { AddAudioForm } from "./add-audio-form";

export const dynamic = "force-dynamic";

type DashboardMedia = {
  id: string;
  title?: string;
  status?: string;
  syncToGarmin?: boolean;
  durationSeconds?: number;
  createdAt?: { toDate?: () => Date } | Date;
};

type Dashboard = {
  media: DashboardMedia[];
  device: Record<string, unknown> | null;
  status: "operational" | "degraded" | "unauthenticated";
};

async function loadDashboard(): Promise<Dashboard> {
  try {
    const session = await auth();
    if (!session?.user?.googleSub)
      return { media: [], device: null, status: "unauthenticated" };
    const db = firestore();
    const [mediaSnapshot, deviceSnapshot] = await Promise.all([
      db
        .collection("media")
        .where("ownerGoogleSub", "==", session.user.googleSub)
        .limit(100)
        .get(),
      db
        .collection("devices")
        .where("ownerGoogleSub", "==", session.user.googleSub)
        .get(),
    ]);
    const media = mediaSnapshot.docs
      .map((document) => ({
        id: document.id,
        ...document.data(),
      }))
      .sort(
        (left, right) =>
          timestamp((right as DashboardMedia).createdAt) -
          timestamp((left as DashboardMedia).createdAt),
      ) as DashboardMedia[];
    const devices = deviceSnapshot.docs
      .map((document) => document.data())
      .sort(
        (left, right) => timestamp(right.createdAt) - timestamp(left.createdAt),
      );
    return {
      media,
      device: devices[0] ?? null,
      status: "operational",
    };
  } catch {
    return { media: [], device: null, status: "degraded" };
  }
}

function timestamp(value: unknown) {
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === "object" && "toDate" in value) {
    const date = (value as { toDate?: () => Date }).toDate?.();
    return date?.getTime() ?? 0;
  }
  return 0;
}

export default async function Home() {
  const dashboard = await loadDashboard();
  const total = dashboard.media.length;
  const synced = dashboard.media.filter(
    (item) => item.syncToGarmin && item.status === "ready",
  ).length;
  const processing = dashboard.media.filter(
    (item) => item.status === "queued" || item.status === "processing",
  ).length;
  const deviceName =
    (dashboard.device?.name as string | undefined) ?? "No device paired";
  const tracks = dashboard.media.slice(0, 8);
  const systemMessage =
    dashboard.status === "operational"
      ? "All systems operational"
      : dashboard.status === "degraded"
        ? "Backend unavailable"
        : "Sign in to view your library";
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">G</span>
          <span>Garmin Audio</span>
        </div>
        <nav aria-label="Primary navigation">
          <a className="nav-item active" href="#library">
            <span>▦</span> Library
          </a>
          <a className="nav-item" href="#devices">
            <span>⌁</span> Devices
          </a>
          <a className="nav-item" href="#settings">
            <span>⚙</span> Settings
          </a>
        </nav>
        <div className="sidebar-foot">
          <span className="status-dot" /> {systemMessage}
        </div>
      </aside>

      <section className="content" id="library">
        <header className="topbar">
          <div>
            <p className="eyebrow">YOUR LIBRARY</p>
            <h1>
              Good morning
              {dashboard.status === "unauthenticated" ? "" : ", Yorick"}.
            </h1>
          </div>
          {dashboard.status === "unauthenticated" ? (
            <a
              className="secondary-button"
              href="/api/auth/signin?callbackUrl=/"
            >
              Sign in with Google
            </a>
          ) : (
            <div className="account">
              <span className="avatar">Y</span>
              <span>Yorick</span>
              <span className="chevron">⌄</span>
            </div>
          )}
        </header>

        <div className="hero-row">
          <div>
            <h2>Your audio, ready to go.</h2>
            <p className="muted">
              Add a YouTube video and it will be prepared for your Garmin.
            </p>
          </div>
          <AddAudioForm />
        </div>

        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-icon mint">♫</span>
            <div>
              <strong>{total}</strong>
              <span>Audio tracks</span>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon amber">↗</span>
            <div>
              <strong>{synced}</strong>
              <span>Synced to Garmin</span>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon blue">◷</span>
            <div>
              <strong>{processing}</strong>
              <span>Processing</span>
            </div>
          </div>
        </div>

        <div className="section-heading">
          <div>
            <h3>Recent audio</h3>
            <p className="muted">
              Your latest additions and their sync status.
            </p>
          </div>
          <button className="filter-button" type="button">
            All status <span>⌄</span>
          </button>
        </div>

        <div className="track-list">
          {tracks.length ? (
            tracks.map((track) => (
              <Track
                key={track.id}
                title={track.title ?? "Untitled audio"}
                detail={`YouTube · ${track.status ?? "queued"}`}
                duration={formatDuration(track.durationSeconds)}
                status={capitalize(track.status ?? "queued")}
                statusClass={statusClass(track.status)}
              />
            ))
          ) : (
            <p className="muted">
              {dashboard.status === "operational"
                ? "No audio has been added yet."
                : systemMessage}
            </p>
          )}
        </div>

        <section className="device-card" id="devices">
          <div className="device-copy">
            <div className="device-icon">⌁</div>
            <div>
              <p className="eyebrow">CONNECTED DEVICE</p>
              <h3>{deviceName}</h3>
              <p className="muted">
                <span className="status-dot" />
                {dashboard.device
                  ? " Connected and ready to sync"
                  : " Pair a Garmin device to sync audio"}
              </p>
            </div>
          </div>
          {dashboard.status === "unauthenticated" ? (
            <a
              className="secondary-button"
              href="/api/auth/signin?callbackUrl=/"
            >
              Sign in to manage <span>→</span>
            </a>
          ) : (
            <a className="secondary-button" href="/pair">
              Manage device <span>→</span>
            </a>
          )}
        </section>
      </section>
    </main>
  );
}

function formatDuration(seconds?: number) {
  if (!seconds) return "—";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function statusClass(status?: string) {
  if (status === "failed") return "failed";
  if (status === "queued" || status === "processing") return "encoding";
  return "ready";
}

function Track({
  title,
  detail,
  duration,
  status,
  statusClass,
  action,
}: {
  title: string;
  detail: string;
  duration: string;
  status: string;
  statusClass: string;
  action?: string;
}) {
  return (
    <article className="track">
      <div className="track-art">♫</div>
      <div className="track-info">
        <h4>{title}</h4>
        <p className="muted">{detail}</p>
      </div>
      <span className="duration">{duration}</span>
      <span className={`badge ${statusClass}`}>
        <i />
        {status}
      </span>
      {action ? (
        <button className="retry-button" type="button">
          {action}
        </button>
      ) : (
        <span className="sync-mark">✓</span>
      )}
      <button
        className="more-button"
        aria-label={`More options for ${title}`}
        type="button"
      >
        •••
      </button>
    </article>
  );
}
