import { useChangeLeverage } from "@/api/tanstack/change-leverage.tanstack";
import { ButtonLoading } from "@/components/ui/button-loading";
import { useAppSelector } from "@/redux/store";
import { toast } from "sonner";

type TProps = {
    isReady: boolean;
    webviewRef: React.RefObject<Electron.WebviewTag | null>;
};

export default function ButtonChangeLeverage({ isReady, webviewRef }: TProps) {
    const changeLeverage = useChangeLeverage();
    const leverage = useAppSelector((state) => state.user.info?.SettingUsers.leverage);

    const clickChangeLeverage = async () => {
        if (!webviewRef.current) {
            toast.warning(`Webview not found`);
            return;
        }
        if (!leverage) {
            toast.warning(`Leverage not found`);
            return;
        }
        changeLeverage.mutate({
            webview: webviewRef.current,
            leverage: leverage,
        });
    };

    return (
        <ButtonLoading
            disabled={!isReady}
            loading={changeLeverage.isPending}
            onClick={clickChangeLeverage}
            className="w-[150px]"
            size="sm"
            variant={`outline`}
        >
            Change Leverage: {leverage || `?`}
        </ButtonLoading>
    );
}
