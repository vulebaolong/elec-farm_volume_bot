import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import { useEffect, useState } from "react";

type TProps = {
    children: React.ReactNode;
};

export default function MantineWithShadcnTheme({ children }: TProps) {
    const [colorScheme, setColorScheme] = useState<"light" | "dark">("light");

    useEffect(() => {
        const html = document.documentElement;
        const observer = new MutationObserver(() => {
            setColorScheme(html.classList.contains("dark") ? "dark" : "light");
        });
        observer.observe(html, { attributes: true, attributeFilter: ["class"] });

        // set initial
        setColorScheme(html.classList.contains("dark") ? "dark" : "light");

        return () => observer.disconnect();
    }, []);

    return <MantineProvider forceColorScheme={colorScheme}>{children}</MantineProvider>;
}
