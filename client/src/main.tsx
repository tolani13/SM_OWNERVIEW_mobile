import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { applyPrimaryTheme, getStoredPrimaryThemeId } from "@/lib/primaryTheme";

applyPrimaryTheme(getStoredPrimaryThemeId());

createRoot(document.getElementById("root")!).render(<App />);
