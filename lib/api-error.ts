import { logServerError } from "@/lib/server-logging";

type ApiErrorOptions = {
  context: string;
  error: unknown;
  message?: string;
  status?: number;
  headers?: HeadersInit;
  payload?: unknown;
  responseBody?: BodyInit | null;
  contentType?: string;
};

export function apiErrorResponse({
  context,
  error,
  message = "An unexpected error occurred.",
  status = 500,
  headers,
  payload,
  responseBody,
  contentType,
}: ApiErrorOptions): Response {
  logServerError(context, error);

  if (responseBody !== undefined) {
    const responseHeaders = new Headers(headers);
    if (contentType && !responseHeaders.has("Content-Type")) {
      responseHeaders.set("Content-Type", contentType);
    }
    return new Response(responseBody, { status, headers: responseHeaders });
  }

  return Response.json(
    payload ?? { success: false, error: { message } },
    { status, headers },
  );
}
