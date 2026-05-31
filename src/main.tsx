import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
// Import des styles globaux de l'application (Tailwind CSS + variables de theme)
import "./styles/index.css";

// Point d'entree de l'application : monte le composant App dans l'element HTML #root
createRoot(document.getElementById("root")!).render(<App />);
