import { createRoot } from "react-dom/client";
import { Home } from "./routes/index";
import "./styles.css";

const root = document.getElementById("root");
if (root) createRoot(root).render(<Home />);
