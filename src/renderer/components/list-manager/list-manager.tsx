import { ClipboardList } from "lucide-react";
import { PageTitle } from "../title-page/title-page";
import WhitelistFarmIoc from "./white-list-farm-ioc/white-list-farm-ioc";
import WhitelistIoc from "./white-list-ioc/white-list-ioc";
import WhitelistScalpIoc from "./white-list-scalp-ioc/white-list-scalp-ioc";
import WhiteListDetail from "./white-list-detail/white-list-detail";

export default function ListManager() {
    return (
        <div>
            <PageTitle title="List Manager" icon={ClipboardList} size="md" />

            <div className="flex gap-5 w-full p-5">
                <div className="flex-1">
                    <WhitelistIoc />
                </div>
                <div className="flex-1">
                    {/* <WhiteListDetail /> */}
                </div>
            </div>
            <div className="flex gap-5 w-full p-5">
                <div className="flex-1">
                    <WhitelistFarmIoc />
                </div>
                <div className="flex-1">
                    <WhitelistScalpIoc />
                </div>
            </div>
        </div>
    );
}
