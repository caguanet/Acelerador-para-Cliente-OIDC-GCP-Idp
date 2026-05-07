import { describe, expect, it } from "vitest";
import { getFriendlyAuthErrorMessage } from "./authErrors";

describe("getFriendlyAuthErrorMessage", () => {
  it("traduce popup-blocked a mensaje entendible", () => {
    const msg = getFriendlyAuthErrorMessage({ code: "auth/popup-blocked" }, "social");
    expect(msg).toContain("ventana");
    expect(msg).not.toContain("auth/");
  });

  it("extrae código auth desde mensaje técnico y no lo expone", () => {
    const msg = getFriendlyAuthErrorMessage(
      { message: "Firebase: Error (auth/popup-blocked)." },
      "social",
    );
    expect(msg).toContain("ventana");
    expect(msg).not.toContain("auth/popup-blocked");
  });

  it("usa fallback por contexto cuando no hay código", () => {
    const msg = getFriendlyAuthErrorMessage({}, "recovery");
    expect(msg).toContain("recuperación");
  });
});

