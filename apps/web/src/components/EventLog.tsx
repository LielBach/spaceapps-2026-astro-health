import { useEffect, useRef } from "react";
import { formatValue, type Catalog, type LogLine, type SessionView } from "@orbivit/core";
import { Label } from "./Source.tsx";

function summary(line: LogLine, catalog: Catalog): string {
  switch (line.stepType) {
    case "trigger":
      return `${line.data.trigger} trigger: ${line.data.findings.join(", ")}`;
    case "question":
      return `asked ${line.data.id}`;
    case "answer":
      return `“${line.data.text}” → ${line.data.findings.join(", ") || "no finding"}`;
    case "test":
      return `requested ${line.data.id}`;
    case "result":
      return `${line.data.values.map((v) => formatValue(catalog, v)).join("; ")} → ${
        line.data.findings.join(", ") || "no finding"
      }`;
    case "diagnosis":
      return line.data.diagnoses
        .map((x) => `${x.name}${x.catalogued ? "" : " (UNCATALOGUED)"} [${x.verificationStatus}]`)
        .join(" · ");
    case "action":
      return line.data.text ?? line.data.id;
    case "followUp":
      return `follow-up until day ${line.data.until.toFixed(1)}`;
    case "close":
      return `resolved: ${line.data.cleared.join(", ")} back in band`;
    case "escalate":
      return `escalated: ${line.data.reason}`;
    case "rejected":
      return `guardrail rejected the proposal: ${line.data.reasons.join("; ")}`;
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
                <td className="muted nowrap">
                  {l.id.split("-").at(-1)}
                  <br />
                  day {l.missionDay.toFixed(2)}
                </td>
                <td>
                  <span className="step">{l.stepType}</span>
                </td>
                <td>
                  {summary(l, view.catalog)}
                  {(l.conditionId ?? l.llm) && (
                    <div className="muted small">
                      {l.conditionId ?? ""}
                      {l.conditionId && l.llm ? " · " : ""}
                      {l.llm
                        ? l.llm.provider === "none"
                          ? "no LLM"
                          : `${l.llm.provider} ${l.llm.model ?? ""}`
                        : ""}
                    </div>
                  )}
                </td>
                <td>
                  <Label kind={l.label} />
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
