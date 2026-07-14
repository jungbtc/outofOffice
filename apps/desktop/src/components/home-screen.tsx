import type { DocumentKind } from "@outofoffice/shared";
import type { RecentFile, RecoveryRecord } from "@outofoffice/storage";

export type ThemeChoice = "light" | "dark" | "system";
interface HomeScreenProps {
  recents: RecentFile[];
  recoveries: RecoveryRecord[];
  theme: ThemeChoice;
  onNew(kind: DocumentKind): void;
  onOpen(): void;
  onOpenRecent(path: string): void;
  onPin(file: RecentFile): void;
  onRecover(record: RecoveryRecord): void;
  onDiscardRecovery(id: string): void;
  onTheme(theme: ThemeChoice): void;
}

const moduleCards = [
  {
    kind: "write",
    eyebrow: "WRITE",
    title: "New document",
    description: "Draft a clean, structured document.",
    mark: "Aa",
  },
  {
    kind: "present",
    eyebrow: "PRESENT",
    title: "New presentation",
    description: "Build a visual story, slide by slide.",
    mark: "▱",
  },
  {
    kind: "calculate",
    eyebrow: "CALCULATE",
    title: "New spreadsheet",
    description: "Organize values and calculate results.",
    mark: "#",
  },
] satisfies ReadonlyArray<{
  kind: DocumentKind;
  eyebrow: string;
  title: string;
  description: string;
  mark: string;
}>;

function friendlyTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(timestamp * 1000),
  );
}

export function HomeScreen(props: HomeScreenProps) {
  return (
    <main className="home-screen">
      <section className="home-hero">
        <p className="eyebrow">YOUR WORKSPACE, YOUR FILES</p>
        <h1>What will you make?</h1>
        <p>Three focused tools. One private, local workspace.</p>
        <div className="creation-grid">
          {moduleCards.map((card) => (
            <button
              key={card.kind}
              className={`creation-card ${card.kind}`}
              onClick={() => props.onNew(card.kind)}
            >
              <span className="card-mark" aria-hidden="true">
                {card.mark}
              </span>
              <span className="card-copy">
                <small>{card.eyebrow}</small>
                <strong>{card.title}</strong>
                <span>{card.description}</span>
              </span>
              <span className="card-arrow">→</span>
            </button>
          ))}
        </div>
        <button className="open-file-button" onClick={props.onOpen}>
          <span>↗</span> Open a file from this computer
        </button>
      </section>

      {props.recoveries.length > 0 && (
        <section className="home-section recovery-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">SAFETY NET</p>
              <h2>Recovered work</h2>
            </div>
            <span>
              {props.recoveries.length} snapshot{props.recoveries.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="file-list">
            {props.recoveries.map((record) => (
              <article key={record.id} className="file-row recovery-row">
                <span className={`file-kind ${record.kind}`}>
                  {record.kind.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <strong>{record.title}</strong>
                  <small>Autosaved {friendlyTime(record.savedAt)}</small>
                </div>
                <button onClick={() => props.onRecover(record)}>Recover</button>
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
            <p className="eyebrow">PICK UP WHERE YOU LEFT OFF</p>
            <h2>Recent files</h2>
          </div>
        </div>
        {props.recents.length ? (
          <div className="file-list">
            {props.recents.map((file) => (
              <article key={file.path} className="file-row">
                <button className="file-main" onClick={() => props.onOpenRecent(file.path)}>
                  <span className={`file-kind ${file.kind}`}>
                    {file.kind.slice(0, 1).toUpperCase()}
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
                  ⌖
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-recents">
            <span>◌</span>
            <p>Your recent files will stay here—only on this computer.</p>
          </div>
        )}
      </section>

      <section className="home-section home-lower-grid">
        <div>
          <p className="eyebrow">TEMPLATES</p>
          <h2>Start from blank</h2>
          <p className="muted">
            The three blank formats above are the built-in offline templates for this milestone.
            Custom template management is on the roadmap.
          </p>
        </div>
        <div className="settings-card">
          <p className="eyebrow">APPLICATION SETTINGS</p>
          <h2>Appearance</h2>
          <div className="theme-switch" role="group" aria-label="Theme">
            {(["light", "dark", "system"] as const).map((theme) => (
              <button
                key={theme}
                className={props.theme === theme ? "is-active" : ""}
                onClick={() => props.onTheme(theme)}
              >
                {theme[0]?.toUpperCase()}
                {theme.slice(1)}
              </button>
            ))}
          </div>
          <small>Interface zoom follows Windows display scaling.</small>
        </div>
      </section>
    </main>
  );
}
