import { connectToDatabase } from "@/lib/db";
import { findSessionUser, getRequestSessionToken, requestHasValidOrigin } from "@/lib/auth";
import { logServerError } from "@/lib/server-logging";
import User from "@/models/User";

const noStore = { "Cache-Control": "no-store" };
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().replace(/[<>\u0000-\u001f]/g, "").slice(0, max) : "";

export async function GET(request: Request) {
  try {
    const user = await findSessionUser(getRequestSessionToken(request));
    if (!user) return Response.json({ success: false, error: { message: "Sign in to continue." } }, { status: 401, headers: noStore });
    await connectToDatabase();
    const record = await User.findById(user.id).select("savedAddress").lean<{ savedAddress?: Record<string, string> } | null>();
    return Response.json({ success: true, data: { address: record?.savedAddress ?? null } }, { headers: noStore });
  } catch (error) {
    logServerError("api/account/address GET", error);
    return Response.json({ success: false, error: { message: "Your address is temporarily unavailable." } }, { status: 503, headers: noStore });
  }
}

export async function PUT(request: Request) {
  if (!requestHasValidOrigin(request)) return Response.json({ success: false, error: { message: "Request origin could not be verified." } }, { status: 403, headers: noStore });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ success: false, error: { message: "Request body must be valid JSON." } }, { status: 400, headers: noStore }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ success: false, error: { message: "Address details are invalid." } }, { status: 400, headers: noStore });
  const data = body as Record<string, unknown>;
  const address = { name: clean(data.name, 80), address: clean(data.address, 180), city: clean(data.city, 100), postalCode: clean(data.postalCode, 20), country: clean(data.country, 80) };
  const fields: Record<string, string> = {};
  if (address.name.length < 2) fields.name = "Enter your full name.";
  if (address.address.length < 5) fields.address = "Enter a complete street address.";
  if (address.city.length < 2) fields.city = "Enter your city.";
  if (!/^[\p{L}\p{N} -]{2,20}$/u.test(address.postalCode)) fields.postalCode = "Enter a valid postal code.";
  if (address.country.length < 2) fields.country = "Enter your country.";
  if (Object.keys(fields).length) return Response.json({ success: false, fields, error: { message: "Check the highlighted fields." } }, { status: 400, headers: noStore });
  try {
    const user = await findSessionUser(getRequestSessionToken(request));
    if (!user) return Response.json({ success: false, error: { message: "Sign in to continue." } }, { status: 401, headers: noStore });
    await connectToDatabase();
    await User.updateOne({ _id: user.id }, { $set: { savedAddress: address } });
    return Response.json({ success: true, data: { address } }, { headers: noStore });
  } catch (error) {
    logServerError("api/account/address PUT", error);
    return Response.json({ success: false, error: { message: "Your address could not be saved." } }, { status: 503, headers: noStore });
  }
}

export async function DELETE(request: Request) {
  if (!requestHasValidOrigin(request)) return Response.json({ success: false, error: { message: "Request origin could not be verified." } }, { status: 403, headers: noStore });
  try {
    const user = await findSessionUser(getRequestSessionToken(request));
    if (!user) return Response.json({ success: false, error: { message: "Sign in to continue." } }, { status: 401, headers: noStore });
    await connectToDatabase();
    await User.updateOne({ _id: user.id }, { $unset: { savedAddress: "" } });
    return Response.json({ success: true, data: { address: null } }, { headers: noStore });
  } catch (error) {
    logServerError("api/account/address DELETE", error);
    return Response.json({ success: false, error: { message: "Your address could not be removed." } }, { status: 503, headers: noStore });
  }
}
