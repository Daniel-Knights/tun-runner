#!/usr/bin/env nodeprettiern
import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import prompts from "prompts";

type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };

enum PackageManager {
  NPM = "npm",
  PNPM = "pnpm",
  Yarn = "yarn",
}

const LOG_PREFIX = "\x1b[34m[tun]\x1b[0m";

function log(message: string): void {
  console.log(`${LOG_PREFIX} ${message}`);
}

function throwError(message: string): never {
  throw new Error(`${LOG_PREFIX} ${message}`);
}

if (process.env.TUN_RUNNER === "true") {
  throwError("nested tun calls are not allowed");
}

const root = process.cwd();
const args = process.argv.slice(2);
const input = args[0];

if (args.includes("--nested")) {
  throwError(`nested tun calls are not supported`);
}

function isJsonObj(val: unknown): val is Record<string, JSONValue> {
  return !!val && typeof val === "object" && !Array.isArray(val);
}

const pkgContents = fs.readFileSync(path.join(root, "package.json"));
const pkg: JSONValue = JSON.parse(pkgContents.toString());

if (!isJsonObj(pkg) || !isJsonObj(pkg.scripts)) {
  throwError("unable to parse scripts");
}

async function getPackageManager(callCount = 0): Promise<PackageManager> {
  if (callCount > 10) {
    log("unable to find lock file, checking available commands...");

    for (const pm of Object.values(PackageManager)) {
      try {
        execSync(`${pm} -v`);

        // eslint-disable-next-line no-await-in-loop
        const answers = await prompts([
          {
            name: "pm",
            type: "confirm",
            message: `Use ${pm}?`,
            initial: true,
          },
        ]);

        if (answers.pm) {
          return pm;
        }
      } catch {
        if (pm === PackageManager.Yarn) {
          throwError("unable to find package manager");
        }
      }
    }
  }

  const currentDir = path.resolve(root, callCount > 0 ? "../".repeat(callCount) : ".");

  if (fs.existsSync(path.join(currentDir, "package-lock.json"))) {
    return PackageManager.NPM;
  }
  if (fs.existsSync(path.join(currentDir, "pnpm-lock.yaml"))) {
    return PackageManager.PNPM;
  }
  if (fs.existsSync(path.join(currentDir, "yarn.lock"))) {
    return PackageManager.Yarn;
  }

  return getPackageManager(callCount + 1);
}

const pm = await getPackageManager();

function runScript(script: string): void {
  spawnSync(pm, ["run", script], {
    stdio: "inherit", // Retain log styles
    env: {
      TUN_RUNNER: "true",
    },
  });
}

const { scripts } = pkg;
const scriptKeys = Object.keys(scripts as object);

if (scriptKeys.includes(input)) {
  runScript(input);
} else {
  const matchingScripts = input
    ? scriptKeys.filter((s) => s !== input && s.startsWith(input))
    : scriptKeys;

  if (matchingScripts.length === 0) {
    throwError(`no matching scripts: ${input}`);
  }

  const answers = await prompts([
    {
      name: "script",
      type: "select",
      message: "Select script",
      choices: matchingScripts.map((s) => ({ title: s })),
    },
  ]);

  const chosenScriptKey = matchingScripts[answers.script];

  if (chosenScriptKey) {
    runScript(chosenScriptKey);
  }
}
