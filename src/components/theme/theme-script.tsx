import { THEME_STORAGE_KEY } from "./theme-constants";

/**
 * Applies the saved theme before first paint so the page never flashes the wrong palette.
 * "system" (or nothing saved) leaves the attribute off and lets prefers-color-scheme decide.
 */
const script = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
