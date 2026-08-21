import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { applyThemeCssVars, ETB_IDP_THEME_COLORS } from "./theme";

describe("applyThemeCssVars", () => {
    beforeEach(() => {
        document.documentElement.removeAttribute("style");
    });

    afterEach(() => {
        document.documentElement.removeAttribute("style");
    });

    it("publica tokens IdP y RGB derivados en :root", () => {
        applyThemeCssVars({
            brandName: "T",
            logoUrl: "/x.svg",
            colors: { ...ETB_IDP_THEME_COLORS },
            hero: { title: "a", subtitle: "b" },
        });
        const s = document.documentElement.style;
        expect(s.getPropertyValue("--brand-primary").trim()).toBe(ETB_IDP_THEME_COLORS.primary);
        expect(s.getPropertyValue("--brand-secondary").trim()).toBe(ETB_IDP_THEME_COLORS.secondary);
        expect(s.getPropertyValue("--brand-card-bg").trim()).toBe(ETB_IDP_THEME_COLORS.cardBackground);
        expect(s.getPropertyValue("--brand-primary-rgb").trim()).toBe("33, 71, 128");
        expect(s.getPropertyValue("--brand-secondary-rgb").trim()).toBe("0, 146, 188");
    });
});
