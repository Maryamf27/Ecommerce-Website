import { authController } from "@/controllers/auth-controller";
import { withApiRequestLogging } from "@/lib/api-request-logging";

export const POST = withApiRequestLogging("POST /api/auth/refresh", authController.refresh);
