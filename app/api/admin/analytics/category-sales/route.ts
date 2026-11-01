
import { connection } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { connectToDatabase } from "@/lib/db";
import { getCategorySalesLast30Days } from "@/services/order-analytics-service";
import { apiErrorResponse } from "@/lib/api-error";

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  await connection();

  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;

  try {
    await connectToDatabase();

    const data = await getCategorySalesLast30Days();

    return Response.json(
      { success: true, data },
      { headers: noStore },
    );
  } catch (error) {
    return apiErrorResponse({ context: "api/admin/analytics/category-sales GET", error, payload: {
        success: false,
        error: { message: "Sales analytics are temporarily unavailable." },
      }, status: 503, headers: noStore });
  }
}
