import type { RecentFile, RecoverySummary } from "@outofoffice/storage";

export type ThemeChoice = "light" | "dark" | "system";

interface HomeScreenProps {
  recents: RecentFile[];
  recoveries: RecoverySummary[];
  theme: ThemeChoice;
  onNew(): void;
  onOpen(): void;
  onOpenRecent(path: string): void;
  onPin(file: RecentFile): void;
  onRecover(record: RecoverySummary): void;
  onDiscardRecovery(id: string): void;
  onTheme(theme: ThemeChoice): void;
}

function friendlyTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(timestamp * 1000),
  );
}

export function HomeScreen(props: HomeScreenProps) {
  return (
    <main className="home-screen">
      <section className="home-hero">
        <div className="hero-copy">
          <p className="eyebrow">PRIVATE · LOCAL · OPEN SOURCE</p>
          <h1>Write without the weight.</h1>
          <p>
            A focused desktop word processor with rich formatting, recovery, and files that stay on
            your computer.
          </p>
          <div className="hero-actions">
            <button className="primary-action" onClick={props.onNew}>
              <span aria-hidden="true">+</span>
              New document
            </button>
            <button className="secondary-action" onClick={props.onOpen}>
              Open .oofdoc
            </button>
          </div>
          <small className="compatibility-note">
            DOCX import is not available yet. The app will never label a conversion as compatible
            until it is fixture-tested.
          </small>
        </div>

        <button className="blank-document-card" onClick={props.onNew}>
          <span className="blank-page" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>
            <strong>Blank document</strong>
            <small>A4 · Normal margins</small>
          </span>
          <b aria-hidden="true">→</b>
        </button>
      </section>

      {props.recoveries.length > 0 && (
        <section className="home-section recovery-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">RECOVERY</p>
              <h2>Unsaved work is safe</h2>
            </div>
            <span>
              {props.recoveries.length} document{props.recoveries.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="file-list">
            {props.recoveries.map((record) => (
              <article key={record.id} className="file-row recovery-row">
                <span className="file-kind" aria-hidden="true">
                  W
                </span>
                <div>
                  <strong>{record.title}</strong>
                  <small>Recovered {friendlyTime(record.savedAt)}</small>
                </div>
                <button onClick={() => props.onRecover(record)}>Open recovery</button>
                <button className="quiet-button" onClick={() => props.onDiscardRecovery(record.id)}>
                  Discard
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="home-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">RECENT DOCUMENTS</p>
            <h2>Continue writing</h2>
          </div>
          {props.recents.length > 0 && <span>{props.recents.length} recent</span>}
        </div>
        {props.recents.length ? (
          <div className="file-list">
            {props.recents.map((file) => (
              <article key={file.path} className="file-row">
                <button className="file-main" onClick={() => props.onOpenRecent(file.path)}>
                  <span className="file-kind" aria-hidden="true">
                    W
                  </span>
                  <span>
                    <strong>{file.title}</strong>
                    <small title={file.path}>{file.path}</small>
                  </span>
                </button>
                <time>{friendlyTime(file.lastOpened)}</time>
                <button
                  className={`pin-button ${file.pinned ? "is-pinned" : ""}`}
                  aria-label={file.pinned ? "Unpin file" : "Pin file"}
                  onClick={() => props.onPin(file)}
                >
                  {file.pinned ? "Pinned" : "Pin"}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-recents">
            <span aria-hidden="true">W</span>
            <div>
              <strong>No recent documents</strong>
              <p>Your local documents will appear here after you save them.</p>
            </div>
          </div>
        )}
      </section>

      <section className="home-section home-lower-grid">
        <div className="privacy-card">
          <p className="eyebrow">BUILT FOR FOCUS</p>
          <h2>Your words, not your account.</h2>
          <p className="muted">
            No sign-in, telemetry, subscription, cloud upload, or background network requests.
            Recovery snapshots stay in your Windows profile.
          </p>
        </div>
        <div className="settings-card">
          <p className="eyebrow">APPEARANCE</p>
          <h2>Interface theme</h2>
          <div className="theme-switch" role="group" aria-label="Theme">
            {(["light", "dark", "system"] as const).map((theme) => (
              <button
                key={theme}
                className={props.theme === theme ? "is-active" : ""}
                aria-pressed={props.theme === theme}
                onClick={() => props.onTheme(theme)}
              >
                {theme[0]?.toUpperCase()}
                {theme.slice(1)}
              </button>
            ))}
          </div>
          <small>Document pages remain white to match printing.</small>
        </div>
      </section>
    </main>
  );
}
