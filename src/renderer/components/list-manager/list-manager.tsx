import { ClipboardList } from "lucide-react";
import { PageTitle } from "../title-page/title-page";
import Whitelist from "./whitelist";
import BlackList from "./black-list";

export default function ListManager() {
    return (
        <div>
            <PageTitle title="List Manager" icon={ClipboardList} size="md" />

            <div className="flex gap-5 w-full p-5">
                <div className="flex-1">
                    <Whitelist />
                </div>
                <div className="flex-1">
                    <BlackList />
                </div>
            </div>
        </div>
    );
}
