import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

export const useToggleDevTool = () => {
    return useMutation({
        mutationFn: async () => {
            const { ok, opened, error }: { ok: boolean; opened: boolean; error?: string } = await window.electron?.ipcRenderer.invoke("devtools:toggle");
            if (!ok) throw new Error(error);
            return opened;
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });
};
