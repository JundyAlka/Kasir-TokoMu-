import { spawn } from "node:child_process";
import net from "node:net";
import { resolve } from "node:path";
import { getLocalMigrationStatus } from "./local-migrations.mjs";

const databasePort = 5439;
const children = new Set();
let shuttingDown = false;

function isPortOpen(port) {
  return new Promise((resolvePort) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });

    socket.once("connect", () => {
      socket.destroy();
      resolvePort(true);
    });
    socket.once("error", () => resolvePort(false));
    socket.setTimeout(500, () => {
      socket.destroy();
      resolvePort(false);
    });
  });
}

async function waitForPort(port, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await isPortOpen(port)) {
      return;
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }

  throw new Error(`PostgreSQL tidak siap di port ${port}.`);
}

function startChild(command, args) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_OPTIONS: `${process.env.NODE_OPTIONS || ""} --dns-result-order=ipv4first`.trim(),
    },
    stdio: "inherit",
  });
  children.add(child);
  child.once("exit", () => children.delete(child));
  return child;
}

async function getMigrationStatusWhenDatabaseReady() {
  let lastError;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      return await getLocalMigrationStatus();
    } catch (error) {
      lastError = error;
      await new Promise((resolveWait) => setTimeout(resolveWait, 500));
    }
  }
  throw lastError;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of children) {
    child.kill("SIGTERM");
  }

  setTimeout(() => process.exit(exitCode), 1_000).unref();
}

process.once("SIGINT", () => shutdown());
process.once("SIGTERM", () => shutdown());

if (!(await isPortOpen(databasePort))) {
  console.log("Menyalakan PostgreSQL lokal...");
  const databaseProcess = startChild(process.execPath, [resolve("scripts/start-db.mjs")]);
  databaseProcess.once("exit", (code) => {
    if (!shuttingDown) {
      console.error(`PostgreSQL berhenti dengan kode ${code ?? 1}.`);
      shutdown(code ?? 1);
    }
  });
  await waitForPort(databasePort);
} else {
  console.log(`PostgreSQL sudah aktif di port ${databasePort}.`);
}

try {
  const migrationStatus = await getMigrationStatusWhenDatabaseReady();
  if (migrationStatus.pending.length > 0) {
    console.warn(
      `\nPERINGATAN SKEMA: ${migrationStatus.pending.length} migrasi lokal belum diterapkan: ${migrationStatus.pending.join(", ")}\nJalankan: npm run db:local:migrate\n`
    );
  } else {
    console.log("Migrasi lokal sudah sinkron.");
  }
} catch (error) {
  console.warn(
    `\nPERINGATAN SKEMA: status migrasi lokal tidak dapat diperiksa. ${error instanceof Error ? error.message : "Unknown error"}\n`
  );
}

// Parse extra argv: convert a bare number into --port <n> so
// `npm run dev -- 3030` works the same as `npm run dev -- --port 3030`.
const extraArgs = process.argv.slice(2);
const parsedArgs = [];
for (let i = 0; i < extraArgs.length; i++) {
  const arg = extraArgs[i];
  if (/^\d+$/.test(arg) && !parsedArgs.includes("--port") && !parsedArgs.includes("-p")) {
    parsedArgs.push("--port", arg);
  } else {
    parsedArgs.push(arg);
  }
}

const nextProcess = startChild(process.execPath, [
  resolve("node_modules/next/dist/bin/next"),
  "dev",
  ...parsedArgs,
]);

nextProcess.once("exit", (code) => {
  if (!shuttingDown) {
    shutdown(code ?? 0);
  }
});
