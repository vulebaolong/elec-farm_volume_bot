import React from "react";

type Theme = "light" | "dark";
type Ctx = {
    theme: Theme;
    isDark: boolean;
    isLight: boolean;
    setTheme: (t: Theme) => void;
    toggleTheme: () => void;
};

const ThemeContext = React.createContext<Ctx | null>(null);

function getSystemTheme(): Theme {
    if (typeof window === "undefined") return "light";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function getInitialTheme(): Theme {
    if (typeof window === "undefined") return "light";
    return (localStorage.getItem("theme") as Theme) || getSystemTheme();
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = React.useState<Theme>(getInitialTheme);

    // áp dụng vào <html> + persist
    React.useEffect(() => {
        const html = document.documentElement;
        html.classList.toggle("dark", theme === "dark");
        localStorage.setItem("theme", theme);
    }, [theme]);

    const setTheme = React.useCallback((t: Theme) => setThemeState(t), []);
    const toggleTheme = React.useCallback(() => setThemeState((prev) => (prev === "dark" ? "light" : "dark")), []);

    const value = React.useMemo(
        () => ({ theme, isDark: theme === "dark", isLight: theme === "light", setTheme, toggleTheme }),
        [theme, setTheme, toggleTheme],
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
    const ctx = React.useContext(ThemeContext);
    if (!ctx) throw new Error("useAppTheme must be used within <AppThemeProvider>");
    return ctx;
}
