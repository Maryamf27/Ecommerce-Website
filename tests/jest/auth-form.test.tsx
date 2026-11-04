import { TextEncoder } from "node:util";
import { act, fireEvent, render, screen } from "@testing-library/react";
import AuthForm from "../../components/AuthForm";

const originalFetch = global.fetch;
const originalTextEncoder = global.TextEncoder;

beforeAll(() => { global.TextEncoder = TextEncoder; });
afterAll(() => {
  if (originalTextEncoder) global.TextEncoder = originalTextEncoder;
  else Reflect.deleteProperty(global, "TextEncoder");
});

function rateLimitedResponse(retryAfter?: string) {
  return {
    status: 429,
    headers: { get: (name: string) => name.toLowerCase() === "retry-after" ? retryAfter ?? null : null },
  } as Response;
}

function submitLogin() {
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "ada@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
  fireEvent.submit(screen.getByRole("button", { name: "Sign in" }).closest("form")!);
}

describe("AuthForm login lockout", () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    if (originalFetch) global.fetch = originalFetch;
    else Reflect.deleteProperty(global, "fetch");
  });

  it("counts down the Retry-After value and re-enables sign-in at zero", async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockResolvedValue(rateLimitedResponse("2")) as typeof fetch;
    render(<AuthForm mode="login" returnTo="/" />);

    await act(async () => { submitLogin(); });
    expect(screen.getByRole("alert")).toHaveTextContent("Try again in 00:02.");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();

    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(screen.getByRole("alert")).toHaveTextContent("Try again in 00:01.");

    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("defaults to a 15-minute lockout when Retry-After is missing", async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockResolvedValue(rateLimitedResponse()) as typeof fetch;
    render(<AuthForm mode="login" returnTo="/" />);

    await act(async () => { submitLogin(); });

    expect(screen.getByRole("alert")).toHaveTextContent("Try again in 15:00.");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
  });
});
