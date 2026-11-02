
import { randomUUID } from "node:crypto";

/** Wraps a route handler with safe, structured request/response logging. */
type RouteHandler<Args extends unknown[]> = (
  ...args: Args
) => Response | Promise<Response>;

export function withApiRequestLogging<Args extends unknown[]>(
  route: string,
  handler: RouteHandler<Args>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args): Promise<Response> => {
    const startedAt = Date.now();

    const request = args.find(
      (value): value is Request =>
        typeof Request !== "undefined" && value instanceof Request,
    );

    const incomingId = request?.headers.get("x-request-id")?.trim();

    const requestId =
      incomingId && /^[a-zA-Z0-9._:-]{1,128}$/.test(incomingId)
        ? incomingId
        : randomUUID();

    let status = 500;

    try {
      const response = await handler(...args);
      status = response.status;

      const headers = new Headers(response.headers);
      headers.set("x-request-id", requestId);

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } finally {
      console.info(
        JSON.stringify({
          level:
            status >= 500 ? "error" : status >= 400 ? "warn" : "info",
          event: "api_request",
          requestId,
          method: request?.method ?? "UNKNOWN",
          route,
          durationMs: Date.now() - startedAt,
          status,
        }),
      );
    }
  };
}
