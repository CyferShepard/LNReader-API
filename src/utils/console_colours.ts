import { green, cyan, yellow, red, bold } from "https://deno.land/std@0.196.0/fmt/colors.ts";

const _log = console.log.bind(console);
const _info = console.info.bind(console);
const _warn = console.warn.bind(console);
const _error = console.error.bind(console);

const prefix = (level: string) => `${new Date().toISOString()} ${level}:`;

console.log = (...args: unknown[]) => _log(green(prefix("LOG")), ...args);
console.info = (...args: unknown[]) => _info(cyan(`${prefix("INFO")} ${args.join(" ")}`));
console.warn = (...args: unknown[]) => _warn(yellow(`${prefix("WARN")} ${args.join(" ")}`));
console.error = (...args: unknown[]) => _error(red(bold(`${prefix("ERROR")} ${args.join(" ")}`)));

// optional: restore originals
export function restoreConsole() {
  console.log = _log;
  console.info = _info;
  console.warn = _warn;
  console.error = _error;
}
