import { SET_VERSIONS } from "@/redux/slices/bot.slice";
import { useAppDispatch } from "@/redux/store";
import { TVersions } from "@/types/version.type";
import { useEffect } from "react";

export const useVersion = () => {
    const dispatch = useAppDispatch()
    useEffect(() => {
        window.electron.ipcRenderer.invoke("app:get-versions").then((v: TVersions) => {
            console.log({ useVersion: v });
            dispatch(SET_VERSIONS(v));
        });
    }, []);
};
