import { useState } from "react";
import type { EventView, SessionView } from "@astrohealth/core";
import { day, post } from "../api.ts";

/** The daily check-in on the ship's tablet: questions, test requests, and the action for approval. */
export function CheckIn({ view, event }: { view: SessionView; event: EventView | undefined }) {
  const [custom, setCustom] = useState("");
  if (!event) {
    return (
      <section className="panel checkin">
        <h2>Daily check-in</h2>
        <p className="muted">
          No open event. Passive monitoring only: the crew is not asked anything.
        </p>
      </section>
    );
  }
  const next = event.pending;
  const { catalog } = view;
  const answered = event.log.filter((l) => l.stepType === "answer" || l.stepType === "result");
  return (
    <section className="panel checkin">
      <h2>
        Daily check-in{" "}
        <small>
          {event.id} · opened {day(event.openedAt)}
        </small>
      </h2>
      {event.phase === "investigating" && next?.kind === "question" && (
        <div className="ask">
          <p className="question">
            {event.pendingWording ?? catalog.questions.find((q) => q.id === next.id)?.text}
          </p>
          <div className="buttons">
            <button
              className="primary"
              onClick={() => void post("answer", { eventId: event.id, questionId: next.id })}
            >
              Answer: “
              {view.overrides[next.id] ??
                view.scripted.answers.byQuestion[next.id] ??
                view.scripted.answers.default}
              ”
            </button>
            <button
              onClick={() =>
                void post("answer", { eventId: event.id, questionId: next.id, text: "yes" })
              }
            >
              Yes
            </button>
            <button
              onClick={() =>
                void post("answer", { eventId: event.id, questionId: next.id, text: "no" })
              }
            >
              No
            </button>
          </div>
          <form
            className="override"
            onSubmit={(e) => {
              e.preventDefault();
              if (!custom) return;
              void post("answer", { eventId: event.id, questionId: next.id, text: custom });
              setCustom("");
            }}
          >
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Live branch: type a different answer"
            />
            <button type="submit">Send</button>
          </form>
        </div>
      )}
      {event.phase === "investigating" && next?.kind === "test" && (
        <div className="ask">
          <p className="question">
            Please run:{" "}
            <strong>{catalog.tests.find((t) => t.id === next.id)?.name ?? next.id}</strong>
          </p>
          <button
            className="primary"
            onClick={() => void post("test", { eventId: event.id, testId: next.id })}
          >
            Run test and record the result
          </button>
        </div>
      )}
      {event.phase === "investigating" && next?.kind === "action" && (
        <div className="ask action">
          <p className="question">
            Recommended action (approved pathway:{" "}
            {catalog.conditions.find((c) => c.id === next.conditionId)?.name}):
          </p>
          <p>
            {
              catalog.conditions
                .find((c) => c.id === next.conditionId)
                ?.actions.find((a) => a.id === next.actionId)?.text
            }
          </p>
          <button className="primary" onClick={() => void post("approve", { eventId: event.id })}>
            Approve (crew medical officer)
          </button>
          <p className="muted small">
            Ground is {view.scenario.mission.commDelayMinutes} min away one way. The crew medical
            officer decides.
          </p>
        </div>
      )}
      {event.phase === "followUp" && (
        <p className="status">
          Follow-up: the passive data must return to baseline by {day(event.followUpUntil ?? 0)}, or
          the event escalates.
        </p>
      )}
      {event.phase === "closed" && (
        <p className={`status outcome-${event.outcome}`}>
          Event {event.outcome}:{" "}
          {String(event.log.at(-1)?.data.reason ?? "follow-up data back in band")}
        </p>
      )}
      {answered.length > 0 && (
        <ul className="answers">
          {answered.map((l) => (
            <li key={l.id}>
              <span className="muted">{l.stepId}</span>{" "}
              {l.stepType === "answer" ? `“${String(l.data.text)}”` : JSON.stringify(l.data.values)}
              {(l.data.findings as string[]).length > 0 && (
                <span className="findings"> → {(l.data.findings as string[]).join(", ")}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
