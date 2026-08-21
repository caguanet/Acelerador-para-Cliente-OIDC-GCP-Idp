/**
 * Tema runtime (`window.APP_CONFIG.theme`) y tokens ETB.
 * Referencia de marca: `.agents/skills/etb-brand-brandbook/reference/brandbook-extract.md`
 * `applyThemeCssVars` publica colores en `:root` para `src/index.css`.
 */

/** Hex de referencia del manual (nombres alineados al extracto). */
export const ETB_BRAND_HEX = {
    azulEtb: "#004c8f",
    azulProfundo: "#214780",
    azulNeonFull: "#00ffff",
    /** Panel / interacción — mismo RGB que en Figma login (manual tabla digital). */
    azulInteraccion: "#0092bc",
    azulMedioEmpresas: "#006ED0",
    salmonPymes: "#d86055",
    blanco: "#ffffff",
} as const;

/**
 * Defaults del IdP Mi ETB: el layout Figma usa **profundo** como ancla tipográfica / hover
 * y **#0092bc** como relleno de CTA y focos (coherente con RGB 0,146,191 del brandbook).
 */
export const ETB_IDP_THEME_COLORS = {
    primary: ETB_BRAND_HEX.azulProfundo,
    secondary: ETB_BRAND_HEX.azulInteraccion,
    accent: "#00E5FF",
    background: "#F8F9FB",
    text: "#080707",
    textSecondary: "#515151",
    /** CTAs secundarios / `--brand-action` (Salmón Pymes; B2B puede usar `#006ED0`). */
    action: ETB_BRAND_HEX.salmonPymes,
    cardBackground: "#fafafa",
    heroGradientStart: "#004b90",
    heroGradientEnd: "#0092bc",
} as const;

export interface ThemeColors {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    action?: string;
    textSecondary?: string;
    /** Superficie de tarjetas / campos (`--brand-card-bg`). */
    cardBackground?: string;
    /** Gradiente hero login móvil (`--brand-hero-gradient-start`). */
    heroGradientStart?: string;
    /** Gradiente hero login móvil (`--brand-hero-gradient-end`). */
    heroGradientEnd?: string;
}

export interface ThemeConfig {
    brandName: string;
    logoUrl: string;
    colors: ThemeColors;
    hero: {
        title: string;
        subtitle: string;
    };
}

/** Preset listo para `window.APP_CONFIG.theme` (copiar también en `public/config.js`). */
export const ETB_APP_THEME_PRESET: Pick<ThemeConfig, "colors" | "hero"> = {
    colors: { ...ETB_IDP_THEME_COLORS },
    hero: {
        title: "Portal de acceso seguro",
        subtitle: "Autenticación centralizada",
    },
};

const defaultConfig: ThemeConfig = {
    brandName: import.meta.env.VITE_APP_BRAND_NAME || "Identity Provider",
    logoUrl: import.meta.env.VITE_APP_LOGO_URL || "/branding/default/logo.svg",
    colors: { ...ETB_IDP_THEME_COLORS },
    hero: {
        title: "Secure Access Portal",
        subtitle: "Identity Management Solution",
    },
};

export const themeConfig: ThemeConfig = {
    ...defaultConfig,
    ...(window.APP_CONFIG?.theme || {}),
    colors: {
        ...defaultConfig.colors,
        ...(window.APP_CONFIG?.theme?.colors || {}),
    },
    hero: {
        ...defaultConfig.hero,
        ...(window.APP_CONFIG?.theme?.hero || {}),
    },
};

/** Sincroniza `themeConfig` con las variables CSS usadas en `index.css`. */
export function applyThemeCssVars(config: ThemeConfig = themeConfig): void {
    const { colors } = config;
    const root = document.documentElement;
    const action = colors.action ?? ETB_IDP_THEME_COLORS.action;
    const textSecondary = colors.textSecondary ?? ETB_IDP_THEME_COLORS.textSecondary;
    const cardBg = colors.cardBackground ?? ETB_IDP_THEME_COLORS.cardBackground;
    const heroGradientStart = colors.heroGradientStart ?? ETB_IDP_THEME_COLORS.heroGradientStart;
    const heroGradientEnd = colors.heroGradientEnd ?? ETB_IDP_THEME_COLORS.heroGradientEnd;

    root.style.setProperty("--brand-primary", colors.primary);
    root.style.setProperty("--brand-secondary", colors.secondary);
    root.style.setProperty("--brand-accent", colors.accent);
    root.style.setProperty("--brand-bg", colors.background);
    root.style.setProperty("--brand-text", colors.text);
    root.style.setProperty("--brand-action", action);
    root.style.setProperty("--brand-text-secondary", textSecondary);
    root.style.setProperty("--brand-card-bg", cardBg);
    root.style.setProperty("--brand-hero-gradient-start", heroGradientStart);
    root.style.setProperty("--brand-hero-gradient-end", heroGradientEnd);

    const pr = hexToRgb(colors.primary);
    const sec = hexToRgb(colors.secondary);
    if (pr) root.style.setProperty("--brand-primary-rgb", `${pr.r}, ${pr.g}, ${pr.b}`);
    if (sec) root.style.setProperty("--brand-secondary-rgb", `${sec.r}, ${sec.g}, ${sec.b}`);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
    if (!m) return null;
    return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}
