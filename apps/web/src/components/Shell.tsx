import { useEffect, useState, type ReactNode } from "react";
import { DEMO_WARNING } from "@amethyst/protocol";

export function Shell({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = window.localStorage.getItem("amethyst-theme");
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("amethyst-theme", theme);
  }, [theme]);

  return (
    <div className="app-shell">
      <div className="demo-notice">
        <button type="button" className="demo-banner">
          {DEMO_WARNING}
        </button>
      </div>
      <header>
        <div className="brand">
          <span className="gem">◆</span> Amethyst
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="theme-toggle"
            onClick={() =>
              setTheme((current) => (current === "dark" ? "light" : "dark"))
            }
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
