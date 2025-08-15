import { HomeIcon } from "lucide-react";
import Process from "../process/process";
import { PageTitle } from "../title-page/title-page";

export default function Home() {
    return (
        <div>
            <PageTitle title="Home" icon={HomeIcon} size="md" />
            <div className="space-y-5">
                <Process />
            </div>
        </div>
    );
}
