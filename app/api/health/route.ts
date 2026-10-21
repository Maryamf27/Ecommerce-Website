import { connectToDatabase } from "@/lib/db";

export async function GET() {
  try {
    await connectToDatabase();
    return Response.json({ status: "healthy", database: "connected" });
  } catch {
    return Response.json(
      { status: "unhealthy", database: "disconnected" },
      { status: 503 },
    );
  }
}
