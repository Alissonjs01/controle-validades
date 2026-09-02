import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const rootUrl = "http://127.0.0.1:3000";

const server = spawn(
  process.execPath,
  [
    "./node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3000"
  ],
  {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  }
);

server.stdout.on("data", (chunk) => process.stdout.write(`[next] ${chunk}`));
server.stderr.on("data", (chunk) => process.stderr.write(`[next] ${chunk}`));

let serverExited = false;
server.once("exit", (code) => {
  serverExited = true;

  if (code !== 0 && code !== null) {
    process.stderr.write(`[next] exited with code ${code}\n`);
  }
});

try {
  await waitForServer(rootUrl);

  const playwrightCli = require.resolve("@playwright/test/cli");
  const exitCode = await runProcess(process.execPath, [
    playwrightCli,
    "test",
    "--reporter=list"
  ]);

  process.exitCode = exitCode;
} finally {
  await stopServer();
}

async function waitForServer(url) {
  const startedAt = Date.now();
  const timeoutMs = 120_000;

  while (Date.now() - startedAt < timeoutMs) {
    if (serverExited) {
      throw new Error("Next dev server exited before becoming ready.");
    }

    try {
      const response = await fetch(url);

      if (response.status < 500) {
        return;
      }
    } catch {
      await sleep(500);
      continue;
    }

    await sleep(500);
  }

  throw new Error(`Timed out waiting for ${url}.`);
}

function waitForServerExit(timeoutMs) {
  if (serverExited) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      server.off("exit", onExit);
      resolve(false);
    }, timeoutMs);

    function onExit() {
      clearTimeout(timer);
      resolve(true);
    }

    server.once("exit", onExit);
  });
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      env: {
        ...process.env,
        PLAYWRIGHT_EXTERNAL_SERVER: "1"
      },
      stdio: options.inherit === false ? "ignore" : "inherit"
    });

    child.once("exit", (code) => resolve(code ?? 1));
  });
}

async function stopServer() {
  if (serverExited || !server.pid) {
    return;
  }

  server.kill("SIGTERM");

  if (await waitForServerExit(2_000)) {
    return;
  }

  if (process.platform === "win32") {
    await runProcess("taskkill", ["/pid", String(server.pid), "/t", "/f"], {
      inherit: false
    });

    if (await waitForServerExit(1_000)) {
      return;
    }
  }

  if (!serverExited) {
    server.kill("SIGKILL");
    await waitForServerExit(1_000);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
