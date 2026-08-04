import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

let viewportSyncFrame: number | undefined;
let lastViewportWidth = 0;
let lastViewportHeight = 0;

function syncVisualViewportSize(): void {
  const viewport = window.visualViewport;
  const root = document.documentElement;
  const width = Math.max(1, Math.round(Math.max(viewport?.width ?? 0, window.innerWidth || 0, root.clientWidth || 0)));
  const height = Math.max(1, Math.round(Math.max(viewport?.height ?? 0, window.innerHeight || 0, root.clientHeight || 0)));
  if (width === lastViewportWidth && height === lastViewportHeight) {
    return;
  }
  lastViewportWidth = width;
  lastViewportHeight = height;
  document.documentElement.style.setProperty("--app-width", `${width}px`);
  document.documentElement.style.setProperty("--app-height", `${height}px`);
}

function scheduleVisualViewportSizeSync(): void {
  if (viewportSyncFrame !== undefined) {
    return;
  }
  viewportSyncFrame = window.requestAnimationFrame(() => {
    viewportSyncFrame = undefined;
    syncVisualViewportSize();
  });
}

function scheduleSettledVisualViewportSizeSync(): void {
  scheduleVisualViewportSizeSync();
  window.setTimeout(scheduleVisualViewportSizeSync, 80);
  window.setTimeout(scheduleVisualViewportSizeSync, 360);
}

syncVisualViewportSize();
window.addEventListener("resize", scheduleVisualViewportSizeSync);
window.addEventListener("orientationchange", scheduleSettledVisualViewportSizeSync);
window.addEventListener("focusin", scheduleSettledVisualViewportSizeSync);
window.addEventListener("focusout", scheduleSettledVisualViewportSizeSync);
window.visualViewport?.addEventListener("resize", scheduleVisualViewportSizeSync);
window.visualViewport?.addEventListener("scroll", scheduleSettledVisualViewportSizeSync);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").then((registration) => registration.update());
  });
}
