import type { ReactNode } from "react";
import { day } from "../api.ts";
import type { Alert } from "../flow.ts";

const ICONS: Record<Alert["level"], string> = {
  none: "✓",
  info: "i",
  caution: "!",
  warning: "!",
  critical: "!!",
};

/** One alert: icon, level in words, title, one sentence. Color is never the only signal. */
export function AlertBanner({ alert, children }: { alert: Alert; children?: ReactNode }) {
  return (
    <div
      className={`alert alert-${alert.level}`}
      role={alert.level === "critical" ? "alert" : "status"}
    >
      <div className="alert-head">
        <span className="alert-icon" aria-hidden="true">
          {ICONS[alert.level]}
        </span>
        <span className="alert-word">{alert.word}</span>
        <span className="alert-title">{alert.title}</span>
      </div>
      {(alert.body !== undefined || alert.day !== undefined) && (
        <div className="alert-body">
          {alert.body}
          {alert.day !== undefined && ` ${day(alert.day)}.`}
        </div>
      )}
      {children}
    </div>
  );
}
