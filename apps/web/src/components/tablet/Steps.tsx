import { useEffect, useState } from "react";
import type { EventView, SessionView, TestSpec } from "@astrohealth/core";
import { post } from "../../api.ts";
import { PHASES, testInstruction, wizardProgress } from "../../flow.ts";
import { Src } from "../Source.tsx";

type Values = Record<string, number | string | boolean>;

/** Questions → Measure → Review, with the done phases ticked. */
export function Stepper({ event }: { event: EventView }) {
  const { phase } = wizardProgress(event);
  return (
    <ol className="stepper">
      {PHASES.map((p, i) => (
        <li key={p} className={i < phase ? "done" : i === phase ? "current" : ""}>
          {i < phase ? "✓ " : ""}
          {p}
        </li>
      ))}
    </ol>
  );
}

/** Open question: a text box in the astronaut's own words. */
function TextAnswer({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  return (
    <form
      className="text-answer"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) {
          setError("Write a few words first, or “nothing”.");
          return;
        }
        onSend(text.trim());
      }}
    >
      <textarea
        value={text}
        rows={4}
        autoFocus
        placeholder="Workouts feel harder than last week"
        aria-label="Your answer"
        onChange={(e) => {
          setText(e.target.value);
          setError("");
        }}
      />
      {error && <span className="error">{error}</span>}
      <div className="big-buttons">
        <button type="submit" className="big primary">
          Send answer
        </button>
      </div>
    </form>
  );
}

/**
 * One question per screen. Yes/No: two big buttons (keys Y and N). Choice: one big button per
 * option (keys 1–9). Text: an open answer.
 */
export function QuestionStep({ view, event }: { view: SessionView; event: EventView }) {
  const [why, setWhy] = useState(false);
  const next = event.pending;
  const id = next?.kind === "question" ? next.id : undefined;
  const question = view.catalog.questions.find((q) => q.id === id);
  const kind = question?.kind ?? "yesNo";
  const answer = (text: string) => {
    if (id) void post("answer", { eventId: event.id, questionId: id, text });
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (kind === "yesNo" && (e.key === "y" || e.key === "Y")) answer("yes");
      if (kind === "yesNo" && (e.key === "n" || e.key === "N")) answer("no");
      const option = kind === "choice" ? question?.options?.[Number(e.key) - 1] : undefined;
      if (option) answer(option.label);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  if (!id) return null;
  const text = event.pendingWording ?? question?.text;
  const rationale = event.log.findLast((l) => l.stepType === "question")?.data.rationale;
  return (
    <div className="step">
      <Stepper event={event} />
      <p className="step-count">
        Question {wizardProgress(event).question}
        {kind === "choice" && " · choose one"}
        {kind === "text" && " · in your own words"}
      </p>
      <p className="step-question">{text}</p>
      {typeof rationale === "string" && (
        <button className="link" onClick={() => setWhy(!why)} aria-expanded={why}>
          {why ? "▾" : "▸"} Why we ask
        </button>
      )}
      {why && typeof rationale === "string" && <p className="why">{rationale}</p>}
      {kind === "yesNo" && (
        <div className="big-buttons">
          <button className="big" onClick={() => answer("yes")}>
            Yes
          </button>
          <button className="big" onClick={() => answer("no")}>
            No
          </button>
        </div>
      )}
      {kind === "choice" && (
        <div className="choices">
          {question?.options?.map((o, i) => (
            <button key={o.label} className="big choice" onClick={() => answer(o.label)}>
              <span className="key" aria-hidden="true">
                {i + 1}
              </span>
              {o.label}
            </button>
          ))}
        </div>
      )}
      {kind === "text" && <TextAnswer key={id} onSend={answer} />}
    </div>
  );
}

/** A device test without a structured finding: one instruction, one Measure button. */
export function TestStep({ view, event }: { view: SessionView; event: EventView }) {
  const next = event.pending;
  if (next?.kind !== "test") return null;
  const spec = view.catalog.tests.find((t) => t.id === next.id);
  if (spec?.form) return <GuidedScan key={spec.id} view={view} event={event} spec={spec} />;
  return (
    <div className="step">
      <Stepper event={event} />
      <p className="step-count">Measurement</p>
      <p className="step-title">
        {spec?.name ?? next.id}
        {spec?.sourceIds?.map((s) => (
          <Src key={s} id={s} />
        ))}
      </p>
      <p className="step-question">{testInstruction(view.catalog, next.id)}</p>
      <div className="big-buttons">
        <button
          className="big primary"
          onClick={() => void post("test", { eventId: event.id, testId: next.id })}
        >
          Measure
        </button>
      </div>
    </div>
  );
}

/** Ultrasound: one checklist step per screen, then the finding as big buttons, then Save. */
function GuidedScan({
  view,
  event,
  spec,
}: {
  view: SessionView;
  event: EventView;
  spec: TestSpec;
}) {
  const checklist = spec.checklist ?? [];
  const total = checklist.length + 1;
  const [i, setI] = useState(0);
  const [values, setValues] = useState<Values>(view.scripted.testResults[spec.id] ?? {});
  const set = (field: string, value: number | boolean) =>
    setValues((v) => ({ ...v, [field]: value }));
  const onForm = i >= checklist.length;
  return (
    <div className="step">
      <Stepper event={event} />
      <div className="scan-head">
        <span className="step-title">{spec.name.replace(/\s*\(structured finding\)/, "")}</span>
        <span className="step-count">
          Step {i + 1} of {total}
        </span>
      </div>
      <div className="progress thin">
        <div style={{ width: `${((i + 1) / total) * 100}%` }} />
      </div>
      {!onForm && <p className="step-question">{checklist[i]}</p>}
      {onForm && (
        <div className="finding-form">
          <p className="step-title">Enter what you see</p>
          {spec.form?.map((f) => (
            <div key={f.field} className="finding-field">
              <span>{f.label}</span>
              <div className="segmented">
                {f.kind === "boolean"
                  ? [true, false].map((b) => (
                      <button
                        key={String(b)}
                        className={values[f.field] === b ? "on" : ""}
                        aria-pressed={values[f.field] === b}
                        onClick={() => set(f.field, b)}
                      >
                        {b ? "Yes" : "No"}
                      </button>
                    ))
                  : f.options?.map((o) => (
                      <button
                        key={o.value}
                        className={values[f.field] === o.value ? "on" : ""}
                        aria-pressed={values[f.field] === o.value}
                        onClick={() => set(f.field, o.value)}
                      >
                        {o.label}
                      </button>
                    ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {spec.sourceIds && (
        <p className="muted small">
          Checklist and grades:
          {spec.sourceIds.map((s) => (
            <Src key={s} id={s} />
          ))}
        </p>
      )}
      <div className="big-buttons">
        <button className="big back" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>
          Back
        </button>
        {onForm ? (
          <button
            className="big primary"
            onClick={() => void post("test", { eventId: event.id, testId: spec.id, values })}
          >
            Save finding
          </button>
        ) : (
          <button className="big primary" onClick={() => setI(i + 1)}>
            Done, next
          </button>
        )}
      </div>
    </div>
  );
}
