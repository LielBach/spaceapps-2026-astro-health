import { useCallback, useEffect, useState } from "react";
import type { SessionView } from "@orbivit/core";

async function story(body: { beat?: number; exit?: boolean }): Promise<void> {
  const response = await fetch("/api/story", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  // 409: the previous beat still runs; the click is dropped on purpose.
  if (!response.ok && response.status !== 409)
    console.error("story", response.status, await response.text());
}

/** Starts presenter mode at the first beat. */
export const startStory = () => story({ beat: 0 });

/**
 * Presenter mode. Next runs the next beat of the story and skips the days in between;
 * Back replays to the beat before. Keys: → Space PageDown = Next, ← PageUp = Back, Esc = Exit.
 * PageDown and PageUp are what most presentation clickers send.
 */
export function StoryBar({ view }: { view: SessionView }) {
  const { beats, current = 0 } = view.story;
  const [busy, setBusy] = useState(false);
  const last = beats.length - 1;

  const go = useCallback(
    async (body: { beat?: number; exit?: boolean }) => {
      if (busy) return;
      setBusy(true);
      try {
        await story(body);
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );
  const next = useCallback(() => {
    if (current < last) void go({ beat: current + 1 });
  }, [current, last, go]);
  const back = useCallback(() => {
    if (current > 0) void go({ beat: current - 1 });
  }, [current, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (["ArrowRight", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        next();
      } else if (["ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        back();
      } else if (e.key === "Escape") {
        void go({ exit: true });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back, go]);

  const beat = beats[current];
  if (!beat) return null;
  return (
    <div className="story-bar" aria-live="polite">
      <div className="story-steps" aria-label="Story steps">
        {beats.map((b, i) => (
          <button
            key={b.title}
            className={i === current ? "dot current" : i < current ? "dot done" : "dot"}
            title={`${i + 1}. ${b.title}`}
            aria-label={`Go to step ${i + 1}: ${b.title}`}
            onClick={() => void go({ beat: i })}
            disabled={busy}
          />
        ))}
        <span className="story-count">
          Step {current + 1} of {beats.length} · Mission day {Math.floor(view.day)}
        </span>
      </div>
      <div className="story-main">
        <div className="story-text">
          <h1>{beat.title}</h1>
          <ul>
            {beat.say.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div className="story-nav">
          <button onClick={back} disabled={busy || current === 0}>
            ← Back
          </button>
          <button className="primary" onClick={next} disabled={busy || current === last}>
            {busy ? "Working…" : current === last ? "End" : "Next →"}
          </button>
          <button className="link" onClick={() => void go({ exit: true })} disabled={busy}>
            Exit presenter mode
          </button>
        </div>
      </div>
    </div>
  );
}
