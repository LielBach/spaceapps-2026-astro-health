import { useEffect, useRef } from "react";
import type { LogLine, SessionView } from "@astrohealth/core";
import { Label } from "./Source.tsx";

function summary(line: LogLine): string {
  const d = line.data;
  switch (line.stepType) {
    case "trigger":
      return `${String(d.trigger)} trigger: ${(d.findings as string[]).join(", ")}`;
    case "question":
      return `asked ${String(d.id)}`;
    case "answer":
      return `“${String(d.text)}” → ${(d.findings as string[]).join(", ") || "no finding"}`;
    case "test":
      return `requested ${String(d.id)}`;
    case "result":
      return `${JSON.stringify(d.values)} → ${(d.findings as string[]).join(", ") || "no finding"}`;
    case "diagnosis":
      return (d.diagnoses as { name: string; catalogued: boolean }[])
        .map((x) => `${x.name}${x.catalogued ? "" : " (UNCATALOGUED)"}`)
        .join(" · ");
    case "action":
      return String(d.text ?? d.id);
    case "followUp":
      return `follow-up until day ${Number(d.until).toFixed(1)}`;
    case "close":
      return `resolved: ${(d.cleared as string[]).join(", ")} back in band`;
    case "escalate":
      return `escalated: ${String(d.reason)}`;
    case "rejected":
      return `guardrail rejected the proposal: ${(d.reasons as string[]).join("; ")}`;
    default:
      return JSON.stringify(d);
  }
}

export function EventLog({ view }: { view: SessionView }) {
  const lines = view.events.flatMap((e) => e.log);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Scroll inside the log box only, not the page.
    const box = end.current?.parentElement;
    if (box) box.scrollTop = box.scrollHeight;
  }, [lines.length]);
  return (
    <section className="panel log">
      <h2>
        Event log <small>runs/{view.runId}.jsonl</small>
      </h2>
      <div className="log-lines">
        <table>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} id={l.id} className={`step-${l.stepType}`}>
                <td className="muted">{l.id.split("-").at(-1)}</td>
                <td className="muted">day {l.missionDay.toFixed(2)}</td>
                <td>
                  <span className="step">{l.stepType}</span>
                </td>
                <td>{summary(l)}</td>
                <td>
                  <Label kind={l.label} />
                </td>
                <td className="muted small">
                  {l.conditionId ?? ""}{" "}
                  {l.llm ? `· ${l.llm.provider === "none" ? "no LLM" : l.llm.provider}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div ref={end} />
      </div>
    </section>
  );
}
