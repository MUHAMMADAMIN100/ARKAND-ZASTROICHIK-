import React from "react";
import ReactDOM from "react-dom/client";
import "./app/styles/tokens.css";
import "./app/styles/global.css";
import "@/shared/ui/ui.css";
import "@/widgets/app-shell/shell.css";
import { App } from "./app/App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
