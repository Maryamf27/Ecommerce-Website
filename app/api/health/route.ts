import { connectToDatabase } from "@/lib/db";
import { logServerError } from "@/lib/server-logging";

export async function GET() {
  try {
    await connectToDatabase();
    return Response.json({ status: "healthy", database: "connected" });
  } catch (error) {
    logServerError("api/health GET", error);
    return Response.json(
      { status: "unhealthy", database: "disconnected" },
      { status: 503 },
    );
  }
}
