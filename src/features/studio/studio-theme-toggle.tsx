"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "dreamface.studio.appearance";
type Theme = "dark" | "light";
const labels: Record<string, [string, string]> = {
  en: ["Switch to light appearance", "Switch to dark appearance"],
  "zh-CN": ["切换为浅色外观", "切换为深色外观"],
  "zh-TW": ["切換為淺色外觀", "切換為深色外觀"],
  es: ["Cambiar a tema claro", "Cambiar a tema oscuro"],
  "pt-BR": ["Mudar para tema claro", "Mudar para tema escuro"],
  fr: ["Passer au thème clair", "Passer au thème sombre"],
  de: ["Zum hellen Design wechseln", "Zum dunklen Design wechseln"],
  ja: ["ライトモードに切り替え", "ダークモードに切り替え"],
  ko: ["밝은 테마로 전환", "어두운 테마로 전환"],
  ar: ["التبديل إلى المظهر الفاتح", "التبديل إلى المظهر الداكن"],
  he: ["מעבר למצב בהיר", "מעבר למצב כהה"],
  it: ["Passa al tema chiaro", "Passa al tema scuro"],
  nl: ["Licht thema inschakelen", "Donker thema inschakelen"],
  ru: ["Включить светлую тему", "Включить тёмную тему"],
  th: ["เปลี่ยนเป็นธีมสว่าง", "เปลี่ยนเป็นธีมมืด"],
  vi: ["Chuyển sang giao diện sáng", "Chuyển sang giao diện tối"]
};

/** Appearance only: does not change any workspace or generation state. */
export function StudioThemeToggle({ locale, showLabel = false }: { locale: string; showLabel?: boolean }) {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    const apply = (value: string | null) => {
      const next = value === "dark" ? "dark" : "light";
      document.documentElement.dataset.studioTheme = next;
      setTheme(next);
    };
    try { apply(localStorage.getItem(STORAGE_KEY)); } catch { apply(document.documentElement.dataset.studioTheme || "light"); }
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) apply(event.newValue);
    };
    const syncCurrentWindow = () => setTheme(document.documentElement.dataset.studioTheme === "dark" ? "dark" : "light");
    window.addEventListener("storage", sync);
    window.addEventListener("dreamface:studio-appearance", syncCurrentWindow);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("dreamface:studio-appearance", syncCurrentWindow);
    };
  }, []);

  const label = (labels[locale] || labels.en)[theme === "dark" ? 0 : 1];
  return (
    <button type="button" className={`studio-theme-toggle${showLabel ? " df-theme-menu-item" : ""}`} aria-label={label} title={label}
      onClick={() => {
        const next = theme === "dark" ? "light" : "dark";
        document.documentElement.dataset.studioTheme = next;
        setTheme(next);
        try { localStorage.setItem(STORAGE_KEY, next); } catch { /* Private browsing may disable storage. */ }
        window.dispatchEvent(new Event("dreamface:studio-appearance"));
      }}>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {theme === "dark" ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5" /></> : <path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z" />}
      </svg>
      {showLabel ? <span>{label}</span> : null}
    </button>
  );
}
