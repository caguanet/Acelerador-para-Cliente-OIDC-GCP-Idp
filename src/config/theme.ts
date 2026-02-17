export interface ThemeConfig {
    brandName: string;
    logoUrl: string;
    colors: {
        primary: string;
        secondary: string;
        accent: string;
        background: string;
        text: string;
    };
    hero: {
        title: string;
        subtitle: string;
    };
}



const defaultConfig: ThemeConfig = {
    brandName: import.meta.env.VITE_APP_BRAND_NAME || "Identity Provider",
    logoUrl: import.meta.env.VITE_APP_LOGO_URL || "/branding/default/logo.png", // Generic fallback
    colors: {
        primary: "#204780", // Keep ETB as default fallback for now, or change to generic blue
        secondary: "#006DCC",
        accent: "#00E4FF",
        background: "#F8F9FB",
        text: "#080707"
    },
    hero: {
        title: "Secure Access Portal",
        subtitle: "Identity Management Solution"
    }
};

export const themeConfig: ThemeConfig = {
    ...defaultConfig,
    ...(window.APP_CONFIG?.theme || {}),
    colors: {
        ...defaultConfig.colors,
        ...(window.APP_CONFIG?.theme?.colors || {})
    },
    hero: {
        ...defaultConfig.hero,
        ...(window.APP_CONFIG?.theme?.hero || {})
    }
};
