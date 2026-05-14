import "dotenv/config";

import { spawn, type ChildProcess } from "node:child_process";

import { deriveTestDatabaseUrl, getDatabaseName } from "./_test-db-url";

function cleanEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    NODE_ENV: env.NODE_ENV ?? "test",
    ...Object.fromEntries(
      Object.entries(env).filter((entry): entry is [string, string] => {
        const [key, value] = entry;
        return key.length > 0 && !key.startsWith("=") && value !== undefined;
      }),
    ),
  };
}

function quoteCmdArg(arg: string): string {
  if (/^[\w:./=@+-]+$/.test(arg)) return arg;
  return `"${arg.replace(/(["^&|<>%])/g, "^$1")}"`;
}

function runPnpm(args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    let child: ChildProcess;
    if (process.platform === "win32") {
      child = spawn(
        process.env.ComSpec ?? "cmd.exe",
        ["/d", "/s", "/c", ["pnpm", ...args].map(quoteCmdArg).join(" ")],
        {
          env,
          stdio: "inherit",
        },
      );
    } else {
      child = spawn("pnpm", args, {
        env,
        stdio: "inherit",
      });
    }

    child.on("error", reject);
    child.on("exit", (code: number | null, signal: NodeJS.Signals | null) => {
      if (signal) {
        reject(new Error(`pnpm ${args.join(" ")} terminated by ${signal}`));
        return;
      }
      if (code && code !== 0) {
        reject(new Error(`pnpm ${args.join(" ")} exited with code ${code}`));
        return;
      }
      resolve();
    });
  });
}

async function main() {
  const commandArgs = process.argv.slice(2);
  if (commandArgs.length === 0) {
    throw new Error(
      "Usage: tsx scripts/with-test-db.ts <pnpm-script> [-- forwarded args]",
    );
  }

  const sourceUrl = process.env.DATABASE_URL;
  if (!sourceUrl) {
    throw new Error("DATABASE_URL is required to derive the local test DB URL.");
  }

  const testUrl =
    process.env.TEST_DATABASE_URL ?? deriveTestDatabaseUrl(sourceUrl);
  const env = cleanEnv({
    ...process.env,
    DATABASE_URL: testUrl,
    SHERDAN_PLAYER_ACCESS_CODE:
      process.env.SHERDAN_PLAYER_ACCESS_CODE ?? "e2e-fallback-secret",
  });

  await runPnpm(["test:db:setup"], env);
  console.log(`running with test database: ${getDatabaseName(testUrl)}`);
  await runPnpm(commandArgs, env);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
