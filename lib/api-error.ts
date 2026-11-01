import { logServerError } from "@/lib/server-logging";

type ApiErrorOptions = {
  context: string;
  error: unknown;
  message: string;
  status?: number;
  headers?: HeadersInit;
};

export function apiErrorResponse({
  context,
  error,
  message,
  status = 500,
  headers,
}: ApiErrorOptions): Response {
  logServerError(context, error);

  return Response.json(
    {
      success: false,
      error: { message },
    },
    { status, headers },
  );
}