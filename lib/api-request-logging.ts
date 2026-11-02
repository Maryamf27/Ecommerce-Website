import { randomUUID } from "node:crypto";

/** Wraps a route handler with safe, structured request/response logging. */
type RouteHandler = (...args: never[]) => Response | Promise<Response>;

export function withApiRequestLogging<T extends RouteHandler>(route: string, handler: T): (...args: Parameters<T>) => Promise<Response> {
  return async (...args: Parameters<T>): Promise<Response> => {
    const startedAt = Date.now();
    const request = args.find((value): value is Request => value instanceof Request);
    const requestId = request?.headers.get("x-request-id")?.slice(0, 128) || randomUUID();
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
    } catch (error) {
      status = 500;
      throw error;
    } finally {
      console.info(JSON.stringify({
        level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
        event: "api_request",
        requestId,
        method: request?.method ?? route.split(" ", 1)[0],
        route,
        durationMs: Date.now() - startedAt,
        status,
      }));
    }
  };
}
