import { CodeXml } from "lucide-react";
import { ScrollOnMount } from "../scroll-to-top/scroll-on-mount";
import { PageTitle } from "../title-page/title-page";
import SettingSelector from "./setting-selector";

export default function SettingDev() {
    return (
        <div>
            <PageTitle title="Setting Dev" icon={CodeXml} size="md" />

            <div className="flex gap-5 w-full p-5">
                <SettingSelector />
            </div>
        </div>
    );
}
