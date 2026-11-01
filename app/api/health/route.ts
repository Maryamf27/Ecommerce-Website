import { connectToDatabase } from "@/lib/db";
import { apiErrorResponse } from "@/lib/api-error";

export async function GET() {
  try {
    await connectToDatabase();
    return Response.json({ status: "healthy", database: "connected" });
  } catch (error) {
    return apiErrorResponse({ context: "api/health GET", error, payload: { status: "unhealthy", database: "disconnected" }, status: 503, headers: undefined });
  }
}
