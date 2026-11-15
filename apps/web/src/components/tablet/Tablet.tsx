import { useEffect, useState } from "react";
import type { EventView, SessionView } from "@astrohealth/core";
import { day } from "../../api.ts";
import {
  crewAlert,
  crewScreen,
  plainEscalation,
  plainStep,
  triggerText,
  type CrewScreen,
} from "../../flow.ts";
import { AlertBanner } from "../AlertBanner.tsx";
import { Label, Src } from "../Source.tsx";
import { QuestionStep, Stepper, TestStep } from "./Steps.tsx";

/** "You answered No" / "Saved: …" for 2 s after each answer or result, also under autopilot. */
function useLastInput(view: SessionView, event: EventView | undefined): string | undefined {
  const last = event?.log.findLast((l) => l.stepType === "answer" || l.stepType === "result");
  const [shown, setShown] = useState<string>();
  useEffect(() => {
    if (!last || !event) return;
    const step = plainStep(view.catalog, last);
    setShown(
      last.stepType === "answer"
        ? `You answered “${step.value}”: ${step.label}`
        : `Saved: ${step.label} — ${step.value}`,
    );
    const timer = setTimeout(() => setShown(undefined), 2000);
    return () => clearTimeout(timer);
    // Only a new log line restarts the message.
  }, [last?.id]);
  return shown;
}

function YourAnswers({ view, event }: { view: SessionView; event: EventView }) {
  const lines = event.log.filter((l) => l.stepType === "answer" || l.stepType === "result");
  if (lines.length === 0) return null;
  return (
    <details className="your-answers">
      <summary>Your answers ({lines.length})</summary>
      <ul>
        {lines.map((l) => {
          const s = plainStep(view.catalog, l);
          return (
            <li key={l.id}>
              <span className="muted">{s.label}</span> <strong>{s.value}</strong>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function Centered({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="centered">
      <span className="centered-icon" aria-hidden="true">
        {icon}
      </span>
      <p className="step-title">{title}</p>
      <p className="muted">{text}</p>
    </div>
  );
}

function Screen({
  screen,
  view,
  event,
  onStart,
  acknowledged,
  onAcknowledge,
}: {
  screen: CrewScreen;
  view: SessionView;
  event: EventView | undefined;
  onStart: () => void;
  acknowledged: boolean;
  onAcknowledge: () => void;
}) {
  switch (screen) {
    case "home":
      return (
        <Centered
          icon="♥"
          title="You don't need to do anything"
          text="AstroHealth watches your wearable data in the background."
        />
      );
    case "checkInReady": {
      const why = triggerText(event!);
      return (
        <div className="step">
          <p className="step-title">Why now</p>
          <p className="step-text">
            {why.text}
            {why.dueDay !== undefined && (
              <>
                {" "}
                {day(why.dueDay)}
                {why.sourceId && <Src id={why.sourceId} />}.
              </>
            )}
          </p>
          <div className="big-buttons">
            <button className="big primary" onClick={onStart}>
              Start check-in
            </button>
          </div>
        </div>
      );
    }
    case "question":
      return <QuestionStep view={view} event={event!} />;
    case "test":
      return <TestStep view={view} event={event!} />;
    case "thinking":
      return (
        <div className="step">
          <Stepper event={event!} />
          <Centered icon="…" title="Preparing the next step…" text="This takes a few seconds." />
        </div>
      );
    case "handedToCmo":
      return (
        <div className="step">
          <Stepper event={event!} />
          <Centered
            icon="✓"
            title="Thank you. You're done"
            text="Your crew medical officer will review your answers."
          />
          <YourAnswers view={view} event={event!} />
        </div>
      );
    case "followUp":
      return (
        <div className="step">
          <Centered
            icon="✓"
            title="Your crew medical officer approved a plan"
            text="Follow it as agreed. AstroHealth checks your wearable data. You don't need to do anything else."
          />
          <YourAnswers view={view} event={event!} />
        </div>
      );
    case "urgent":
      return (
        <div className={`urgent${acknowledged ? " acknowledged" : ""}`}>
          <p className="urgent-word">!! Urgent</p>
          <p className="urgent-title">Contact your crew medical officer now</p>
          <p className="urgent-text">{plainEscalation(event!)}</p>
          <p className="urgent-text small">
            Ground is {view.scenario.mission.commDelayMinutes} min away one way. Your crew medical
            officer decides. AstroHealth does not prescribe.
          </p>
          {acknowledged ? (
            <p className="urgent-ack">Acknowledged. Your crew medical officer has the details.</p>
          ) : (
            <button className="big danger" onClick={onAcknowledge}>
              I understand
            </button>
          )}
        </div>
      );
    case "resolved":
      return (
        <Centered
          icon="✓"
          title="Resolved"
          text="Your data is back to your normal. AstroHealth keeps watching in the background."
        />
      );
  }
}

/** The astronaut's tablet: status line, one alert, one screen at a time. */
export function Tablet({ view, event }: { view: SessionView; event: EventView | undefined }) {
  const [startedFor, setStartedFor] = useState<string>();
  const [ackFor, setAckFor] = useState<string>();
  const screen = crewScreen(event, startedFor !== undefined && startedFor === event?.id);
  const alert = crewAlert(screen, event);
  const lastInput = useLastInput(view, event);
  const { astronaut, scenario } = view;
  return (
    <section className="tablet" data-screen={screen} aria-label="Astronaut tablet">
      <div className="tablet-status">
        <span>
          <strong>{astronaut.displayName}</strong>{" "}
          {astronaut.composite && <Label kind="COMPOSITE" />}
        </span>
        <span>
          Day {view.day.toFixed(0)} · comm delay {scenario.mission.commDelayMinutes} min
        </span>
      </div>
      {screen !== "urgent" && <AlertBanner alert={alert} />}
      <div
        className="tablet-screen"
        key={`${screen}-${event?.pending ? JSON.stringify(event.pending) : ""}`}
      >
        <Screen
          screen={screen}
          view={view}
          event={event}
          onStart={() => setStartedFor(event?.id)}
          acknowledged={ackFor !== undefined && ackFor === event?.id}
          onAcknowledge={() => setAckFor(event?.id)}
        />
      </div>
      <p className={`last-input${lastInput ? " shown" : ""}`} aria-live="polite">
        {lastInput ?? " "}
      </p>
    </section>
  );
}
