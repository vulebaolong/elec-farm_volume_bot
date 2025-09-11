import { Settings } from "lucide-react";
import { PageTitle } from "../title-page/title-page";
import SettingAdminUser from "./setting-admin-user";

export default function Setting() {
    return (
        <div>
            <PageTitle title="Setting" icon={Settings} size="md" />

            <div className="flex gap-5 w-full p-5">
                <SettingAdminUser type="admin" />
                <SettingAdminUser type="user" />
            </div>
        </div>
    );
}
