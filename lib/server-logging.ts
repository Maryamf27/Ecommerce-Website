import { inspect } from "node:util";

function redactSensitiveValues(value: string): string {
  return value
    .replace(/mongodb(?:\+srv)?:\/\/[^\s"'`]+/gi, "[redacted MongoDB URI]")
    .replace(/((?:password|passwd|pwd|secret|token|api[_-]?key)\s*[:=]\s*)[^\s,;]+/gi, "$1[redacted]");
}

function formatError(error: unknown, depth = 0): string {
  if (depth > 3) return "[cause depth limit]";
  if (!(error instanceof Error)) {
    if (typeof error === "object" && error !== null) {
      return redactSensitiveValues(inspect(error, { depth: 2, colors: false, breakLength: 120 }));
    }
    return String(error);
  }

  const code = "code" in error && (typeof error.code === "string" || typeof error.code === "number")
    ? ` (${error.code})`
    : "";
  const details = `${error.name}${code}: ${error.message}`;
  const cause = "cause" in error ? error.cause : undefined;
  const causeDetails = cause === undefined ? "" : `\nCaused by: ${formatError(cause, depth + 1)}`;
  const reason = "reason" in error ? error.reason : undefined;
  const reasonDetails = reason === undefined ? "" : `\nReason: ${formatError(reason, depth + 1)}`;
  const aggregateDetails = error instanceof AggregateError
    ? `\nContained errors: ${Array.from(error.errors, (item) => formatError(item, depth + 1)).join("; ")}`
    : "";
  const stack = depth === 0 && error.stack ? `\n${error.stack}` : "";
  return redactSensitiveValues(`${details}${causeDetails}${reasonDetails}${aggregateDetails}${stack}`);
}

/** Logs diagnostic details to the server terminal, with connection credentials redacted. */
export function logServerError(context: string, error: unknown): void {
  console.error(`[${context}] ${formatError(error)}`);
}
