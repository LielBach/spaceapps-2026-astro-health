import { useState } from "react";
import type { EventView, SessionView, TestSpec } from "@astrohealth/core";
import { day, post } from "../api.ts";
import { Scan } from "./Record.tsx";
import { Src } from "./Source.tsx";

type Values = Record<string, number | string | boolean>;

/** Why the event opened, in plain words (Demo 1 step 3). */
function TriggerSummary({ event }: { event: EventView }) {
  const data = event.log[0]?.data ?? {};
  const findings = (data.findings as string[] | undefined) ?? [];
  const surveillance = data.surveillance as
    | { dueDay: number; early: boolean; daysEarly: number; sourceId: string }
    | undefined;
  if (event.trigger === "surveillance" && surveillance) {
    return (
      <p className="trigger">
        Surveillance trigger: your record has an earlier vascular-flow finding that needs follow-up
        under the mission medical protocol (due by {day(surveillance.dueDay)}
        <Src id={surveillance.sourceId} />
        ).
        {surveillance.early &&
          ` A sustained change in your sleeping heart rate brings it forward by ${surveillance.daysEarly} days.`}
      </p>
    );
  }
  return (
    <p className="trigger">
      {event.trigger === "urgent" ? "Urgent interrupt" : "Passive monitoring"}:{" "}
      {findings.join(", ")}
    </p>
  );
}

/** Operator checklist and structured finding (Demo 1 step 7). AstroHealth does not read images. */
function StructuredFinding({
  event,
  spec,
  scripted,
}: {
  event: EventView;
  spec: TestSpec;
  scripted: Values;
}) {
  const [values, setValues] = useState<Values>(scripted);
  const set = (field: string, value: number | boolean | undefined) =>
    setValues((v) => {
      const next = { ...v };
      if (value === undefined) delete next[field];
      else next[field] = value;
      return next;
    });
  return (
    <div className="structured">
      {spec.checklist && (
        <ol className="checklist">
          {spec.checklist.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
      {spec.sourceIds && (
        <p className="muted small">
          Checklist and grades:
          {spec.sourceIds.map((s) => (
            <Src key={s} id={s} />
          ))}
        </p>
      )}
      <div className="form">
        {spec.form?.map((f) =>
          f.kind === "boolean" ? (
            <label key={f.field}>
              <input
                type="checkbox"
                checked={values[f.field] === true}
                onChange={(e) => set(f.field, e.target.checked)}
              />
              {f.label}
            </label>
          ) : (
            <label key={f.field}>
              {f.label}
              <select
                value={typeof values[f.field] === "number" ? String(values[f.field]) : ""}
                onChange={(e) => set(f.field, e.target.value ? Number(e.target.value) : undefined)}
              >
                <option value="">—</option>
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ),
        )}
      </div>
      <button
        className="primary"
        onClick={() => void post("test", { eventId: event.id, testId: spec.id, values })}
      >
        Record the structured finding
      </button>
    </div>
  );
}

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
  const lastStep = event.log.findLast((l) => ["question", "test", "action"].includes(l.stepType));
  const rationale =
    typeof lastStep?.data.rationale === "string" ? lastStep.data.rationale : undefined;
  const spec = (id: string) => catalog.tests.find((t) => t.id === id);
  // An approved escalating action closes the event with the action's text (Demo 1 step 8).
  const escalation = event.log.findLast((l) => l.stepType === "escalate" && l.data.text);
  return (
    <section className="panel checkin">
      <h2>
        Daily check-in{" "}
        <small>
          {event.id} · opened {day(event.openedAt)}
        </small>
      </h2>
      <TriggerSummary event={event} />
      {view.reasoning && <p className="reasoning">Reasoner is choosing the next step…</p>}
      {rationale && event.phase === "investigating" && next && (
        <p className="rationale">
          <span className="muted">Why this step:</span> {rationale}
        </p>
      )}
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
          {spec(next.id)?.form ? (
            <StructuredFinding
              key={next.id}
              event={event}
              spec={spec(next.id)!}
              scripted={view.scripted.testResults[next.id] ?? {}}
            />
          ) : (
            <button
              className="primary"
              onClick={() => void post("test", { eventId: event.id, testId: next.id })}
            >
              Run test and record the result
            </button>
          )}
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
      {event.phase === "closed" && escalation && (
        <div className="report">
          <p className="report-title">Urgent finding — {String(escalation.data.reason)}</p>
          <p>{String(escalation.data.text)}</p>
          <p className="muted small">
            Suspected, not confirmed. The crew medical officer decides; ground review when the link
            allows ({view.scenario.mission.commDelayMinutes} min one way). AstroHealth does not
            prescribe.
          </p>
        </div>
      )}
      {event.phase === "closed" && !escalation && (
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
      {answered
        .filter((l) => l.stepType === "result" && l.stepId && view.testImages[l.stepId])
        .map((l) => (
          <Scan
            key={l.id}
            media={view.testImages[l.stepId!]!}
            title={`Today's scan (${day(l.missionDay)})`}
          />
        ))}
    </section>
  );
}
