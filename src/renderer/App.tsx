import { MemoryRouter as Router } from "react-router-dom";
import { useInitTheme } from "./hooks/use-init-theme";
import "./index.css";
import AppRoutes from "./routers/routes";
import { useInitData } from "./hooks/use-init-data";

export default function App() {
    useInitTheme();
    useInitData();

    return (
        <Router>
            <AppRoutes />
        </Router>
    );
}
