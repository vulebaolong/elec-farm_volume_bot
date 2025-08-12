import { MemoryRouter as Router } from "react-router-dom";
import { useInitData } from "./hooks/use-init-data";
import { useInitTheme } from "./hooks/use-init-theme";
import { useVersion } from "./hooks/use-version.hook";
import "./index.css";
import AppRoutes from "./routers/routes";

export default function App() {
    useInitTheme();
    useInitData();
    useVersion();

    return (
        <Router>
            <AppRoutes />
        </Router>
    );
}
