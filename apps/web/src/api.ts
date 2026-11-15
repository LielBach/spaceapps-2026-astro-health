import { useEffect, useState } from "react";
import type { SessionView } from "@astrohealth/core";

/** Live session view from the server (SSE). */
export function useSession(): { view: SessionView | undefined; connected: boolean } {
  const [view, setView] = useState<SessionView>();
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const source = new EventSource("/api/stream");
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (message: MessageEvent<string>) =>
      setView(JSON.parse(message.data) as SessionView);
    return () => source.close();
  }, []);
  return { view, connected };
}

export async function post(path: string, body: unknown): Promise<void> {
  const response = await fetch(`/api/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) console.error(path, response.status, await response.text());
}

export const day = (t: number) => `Day ${t.toFixed(1)}`;
