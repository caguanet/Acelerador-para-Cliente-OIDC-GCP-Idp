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

  it("preserva mensajes seguros del BFF cuando no hay código auth", () => {
    const msg = getFriendlyAuthErrorMessage(
      { message: "No encontramos una cuenta registrada con ese correo." },
      "otp",
    );
    expect(msg).toBe("No encontramos una cuenta registrada con ese correo.");
  });

  it("no expone mensajes técnicos sin código auth", () => {
    const msg = getFriendlyAuthErrorMessage(
      { message: "MuleSoft MS-2 Login OTP returned status 500" },
      "otp",
    );
    expect(msg).toBe("No fue posible validar el código. Inténtalo nuevamente.");
  });
});
