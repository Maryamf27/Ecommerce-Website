/** @jest-environment node */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import request from "supertest";
import { POST as login } from "../../app/api/auth/login/route";
import { POST as register } from "../../app/api/auth/register/route";
import { authService } from "../../services/auth-service";

const APP_ORIGIN = "https://shop.example.com";
const env = process.env as Record<string, string | undefined>;

function createAuthServer(handler: (request: Request) => Promise<Response>) {
  return createServer(async (incoming: IncomingMessage, outgoing: ServerResponse) => {
    const chunks: Buffer[] = [];
    for await (const chunk of incoming) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));

    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
      else if (value !== undefined) headers.set(name, value);
    }

    const body = Buffer.concat(chunks).toString();
    const webRequest = new Request(`http://${incoming.headers.host}${incoming.url}`, {
      method: incoming.method,
      headers,
      ...(body ? { body } : {}),
    });
    const response = await handler(webRequest);
    response.headers.forEach((value, name) => {
      if (name !== "set-cookie") outgoing.setHeader(name, value);
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length > 0) outgoing.setHeader("Set-Cookie", cookies);
    outgoing.statusCode = response.status;
    outgoing.end(await response.text());
  });
}

const user = { id: "customer-1", name: "Ada Lovelace", email: "ada@example.com", role: "customer" as const };
const session = {
  accessToken: "a".repeat(43),
  refreshToken: "r".repeat(64),
  accessExpiresAt: new Date(Date.now() + 10 * 60_000),
  refreshExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
};

describe("authentication HTTP routes", () => {
  const originalEnvironment = { ...process.env };
  const registerServer = createAuthServer(register);
  const loginServer = createAuthServer(login);

  beforeAll(() => {
    env.NODE_ENV = "production";
    env.APP_ORIGIN = APP_ORIGIN;
  });

  afterAll(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnvironment)) delete process.env[key];
    }
    Object.assign(process.env, originalEnvironment);
  });

  afterEach(() => jest.restoreAllMocks());

  it("creates an account for valid signup details", async () => {
    jest.spyOn(authService, "register").mockResolvedValue({ kind: "success", user, session });

    const response = await request(registerServer)
      .post("/api/auth/register")
      .set("Origin", APP_ORIGIN)
      .send({ name: "Ada Lovelace", email: "ada@example.com", password: "password123", confirmPassword: "password123" });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ success: true, data: { user } });
    expect(response.headers["set-cookie"]).toHaveLength(2);
  });

  it("returns a conflict for a duplicate email", async () => {
    jest.spyOn(authService, "register").mockRejectedValue(Object.assign(new Error("duplicate"), { code: 11000 }));

    const response = await request(registerServer)
      .post("/api/auth/register")
      .set("Origin", APP_ORIGIN)
      .send({ name: "Ada Lovelace", email: "ada@example.com", password: "password123", confirmPassword: "password123" });

    expect(response.status).toBe(409);
    expect(response.body.fields.email).toMatch(/already exists/i);
  });

  it("rejects a wrong password with the generic unauthorized response", async () => {
    jest.spyOn(authService, "login").mockResolvedValue({ kind: "invalid_credentials" });

    const response = await request(loginServer)
      .post("/api/auth/login")
      .set("Origin", APP_ORIGIN)
      .send({ email: "ada@example.com", password: "wrong-password" });

    expect(response.status).toBe(401);
    expect(response.body.error.message).toMatch(/email or password is incorrect/i);
  });

  it("rejects empty login and signup fields before calling the auth service", async () => {
    const registerSpy = jest.spyOn(authService, "register");
    const loginSpy = jest.spyOn(authService, "login");
    const [signup, signIn] = await Promise.all([
      request(registerServer).post("/api/auth/register").set("Origin", APP_ORIGIN).send({}),
      request(loginServer).post("/api/auth/login").set("Origin", APP_ORIGIN).send({}),
    ]);

    expect(signup.status).toBe(400);
    expect(signup.body.fields).toEqual(expect.objectContaining({
      name: expect.any(String),
      email: expect.any(String),
      password: expect.any(String),
      confirmPassword: expect.any(String),
    }));
    expect(signIn.status).toBe(400);
    expect(signIn.body.fields).toEqual(expect.objectContaining({
      email: expect.any(String),
      password: expect.any(String),
    }));
    expect(registerSpy).not.toHaveBeenCalled();
    expect(loginSpy).not.toHaveBeenCalled();
  });
});
