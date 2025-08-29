import { Toaster } from "@/components/ui/sonner";
import { useAppTheme } from "./app-theme.provider";

type TProps = {
    children: React.ReactNode;
};

export default function SonnerProvider({ children }: TProps) {
    const { theme } = useAppTheme();

    return (
        <>
            {children}
            <Toaster theme={theme} richColors />
        </>
    );
}
