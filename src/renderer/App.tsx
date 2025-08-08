import { MemoryRouter as Router } from "react-router-dom";
import { useInitTheme } from "./hooks/use-init-theme";
import "./index.css";
import AppRoutes from "./routers/routes";
import { useEffect } from "react";
import { useSocket } from "./hooks/socket.hook";
import { TSocketRes } from "./types/base.type";
import { TSetting } from "./types/setting.type";
import { useAppDispatch } from "./redux/store";
import { SET_SETTING_BOT } from "./redux/slices/setting.slice";

export default function App() {
    useInitTheme();
    const socket = useSocket();
    const dispatch = useAppDispatch();

    useEffect(() => {
        if (!socket?.socket) return;

        const handleSetting = ({ data }: TSocketRes<TSetting[]>) => {
            dispatch(SET_SETTING_BOT(data));
        };

        socket.socket.on("setting", handleSetting);

        return () => {
            socket.socket?.off("setting", handleSetting);
        };
    }, [socket?.socket]);

    return (
        <Router>
            <AppRoutes />
        </Router>
    );
}
