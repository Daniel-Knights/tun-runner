#!/usr/bin/env node
import { spawnSync } from "node:child_process";
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

const LOG_PREFIX = "\x1b[34m[tun]\x1b[0m";

if (process.env.TUN_RUNNER === "true") {
  throw new Error(`${LOG_PREFIX} nested tun calls are not allowed`);
}

const root = process.cwd();
const args = process.argv.slice(2);
const input = args[0];

if (args.includes("--nested")) {
  throw new Error(`${LOG_PREFIX} nested tun calls are not supported`);
}

function isJsonObj(val: unknown): val is Record<string, JSONValue> {
  return !!val && typeof val === "object" && !Array.isArray(val);
}

const pkgContents = fs.readFileSync(path.join(root, "package.json"));
const pkg: JSONValue = JSON.parse(pkgContents.toString());

if (!isJsonObj(pkg) || !isJsonObj(pkg.scripts)) {
  throw new Error(`${LOG_PREFIX} unable to parse scripts`);
}

function getPackageManager(callCount = 0): "npm" | "pnpm" | "yarn" {
  if (callCount > 20) {
    throw new Error(`${LOG_PREFIX} unable to find package manager`);
  }

  const currentDir = path.resolve(root, callCount > 0 ? "../".repeat(callCount) : ".");

  if (fs.existsSync(path.join(currentDir, "package-lock.json"))) {
    return "npm";
  }
  if (fs.existsSync(path.join(currentDir, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  if (fs.existsSync(path.join(currentDir, "yarn.lock"))) {
    return "yarn";
  }

  return getPackageManager(callCount + 1);
}

const pm = getPackageManager();

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
    throw new Error(`${LOG_PREFIX} no matching scripts: ${input}`);
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
