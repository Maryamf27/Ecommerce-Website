import { connectToDatabase } from "@/lib/db";
import { apiErrorResponse } from "@/lib/api-error";

import { withApiRequestLogging } from "@/lib/api-request-logging";
async function GETHandler(_request: Request) {
  try {
    await connectToDatabase();
    return Response.json({ status: "healthy", database: "connected" });
  } catch (error) {
    return apiErrorResponse({ context: "api/health GET", error, payload: { status: "unhealthy", database: "disconnected" }, status: 503, headers: undefined });
  }
}

export const GET = withApiRequestLogging("GET /api/health", GETHandler);
