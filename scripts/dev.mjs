import { spawn } from "node:child_process";
import net from "node:net";
import { resolve } from "node:path";

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
    env: process.env,
    stdio: "inherit",
  });
  children.add(child);
  child.once("exit", () => children.delete(child));
  return child;
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

const nextProcess = startChild(process.execPath, [
  resolve("node_modules/next/dist/bin/next"),
  "dev",
]);

nextProcess.once("exit", (code) => {
  if (!shuttingDown) {
    shutdown(code ?? 0);
  }
});
