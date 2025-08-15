import { Settings } from "lucide-react";
import { PageTitle } from "../title-page/title-page";
import SettingAdminUser from "./setting-admin-user";
import { ScrollOnMount } from "../scroll-to-top/scroll-on-mount";

export default function setting() {
    return (
        <div>
            <PageTitle title="Setting" icon={Settings} size="md" />
            <ScrollOnMount offset={80} />

            <div className="flex gap-5 w-full p-5">
                <SettingAdminUser type="admin" />
                <SettingAdminUser type="user" />
            </div>
        </div>
    );
}
