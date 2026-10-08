"use client";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
export default function Theme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    let d = false;
    try {
      d = localStorage.getItem("tipsy-theme") === "dark";
    } catch {
      /* Preferences are optional when browser storage is denied. */
    }
    setDark(d);
    document.documentElement.dataset.theme = d ? "dark" : "light";
  }, []);
  return (
    <button
      className="icon-button"
      aria-label="Toggle theme"
      onClick={() => {
        const d = !dark;
        setDark(d);
        try {
          localStorage.setItem("tipsy-theme", d ? "dark" : "light");
        } catch {
          /* Theme still works for this session. */
        }
        document.documentElement.dataset.theme = d ? "dark" : "light";
      }}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
