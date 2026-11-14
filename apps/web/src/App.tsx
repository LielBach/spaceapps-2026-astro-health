import { DATA_LABELS } from "@astrohealth/core";

export function App() {
  return (
    <main>
      <h1>AstroHealth</h1>
      <p>Decision support. Suspected diagnoses are for crew medical officer confirmation.</p>
      <p>Data labels: {DATA_LABELS.join(" · ")}</p>
    </main>
  );
}
