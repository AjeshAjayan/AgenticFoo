import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "agent-foo-theme";
const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

function readSaved(): Theme | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : null;
  } catch {
    return null;
  }
}

/** Light/dark switch. Follows the system setting until the user picks one, then remembers it. */
export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>(() => readSaved() ?? (darkQuery().matches ? "dark" : "light"));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Keep following the system setting while the user hasn't chosen.
  useEffect(() => {
    const query = darkQuery();
    const onChange = (e: MediaQueryListEvent) => {
      if (!readSaved()) setTheme(e.matches ? "dark" : "light");
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const choose = (next: Theme) => {
    setTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage blocked: the choice lasts for this visit only.
    }
  };

  return (
    <div className="theme-switch" role="group" aria-label="Theme">
      {(["light", "dark"] as const).map((option) => (
        <button key={option} type="button" aria-pressed={theme === option} onClick={() => choose(option)}>
          {option === "light" ? "Light" : "Dark"}
        </button>
      ))}
    </div>
  );
}
