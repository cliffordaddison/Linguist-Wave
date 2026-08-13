import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// #region agent log
window.addEventListener("error", (e) => {
  fetch("http://127.0.0.1:7526/ingest/874b278f-a88a-47bd-bce0-8e50d0fe1f30", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "033511" },
    body: JSON.stringify({
      sessionId: "033511",
      runId: "blank-screen",
      hypothesisId: "A",
      location: "main.tsx:error",
      message: "window.error",
      data: { msg: String(e.message || ""), filename: String((e as ErrorEvent).filename || ""), lineno: (e as ErrorEvent).lineno || 0 },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
});
window.addEventListener("unhandledrejection", (e) => {
  fetch("http://127.0.0.1:7526/ingest/874b278f-a88a-47bd-bce0-8e50d0fe1f30", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "033511" },
    body: JSON.stringify({
      sessionId: "033511",
      runId: "blank-screen",
      hypothesisId: "A",
      location: "main.tsx:unhandledrejection",
      message: "unhandledrejection",
      data: { reason: String((e as PromiseRejectionEvent).reason || "") },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
});
fetch("http://127.0.0.1:7526/ingest/874b278f-a88a-47bd-bce0-8e50d0fe1f30", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "033511" },
  body: JSON.stringify({
    sessionId: "033511",
    runId: "blank-screen",
    hypothesisId: "B",
    location: "main.tsx:boot",
    message: "main boot after App import",
    data: { hasRoot: !!document.getElementById("root") },
    timestamp: Date.now(),
  }),
}).catch(() => {});
// #endregion

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
