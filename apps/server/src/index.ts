import { buildApp } from "./app.ts";

const port = Number(process.env.PORT ?? 3001);
const app = buildApp({ clock: true });

app.listen({ port, host: "127.0.0.1" }).then(
  (address) => console.log(`AstroHealth server listening on ${address}`),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
