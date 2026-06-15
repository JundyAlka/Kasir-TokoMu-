import EmbeddedPostgres from "embedded-postgres";
import { access } from "node:fs/promises";

const databaseDir = "./.local/postgres";

const pg = new EmbeddedPostgres({
  databaseDir,
  user: "postgres",
  password: "postgres",
  port: 5439,
  persistent: true,
  onLog: (message) => console.log(String(message).trimEnd()),
  onError: (message) => console.error(String(message).trimEnd()),
});

async function start() {
  try {
    await access(`${databaseDir}/PG_VERSION`);
  } catch {
    await pg.initialise();
  }

  await pg.start();

  try {
    await pg.createDatabase("warungos");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (!message.toLowerCase().includes("already exists")) {
      throw error;
    }
  }

  console.log("Embedded Postgres ready on localhost:5439 (database: warungos)");
}

await start();

const shutdown = async () => {
  await pg.stop();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await new Promise(() => {});
