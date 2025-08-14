import { HomeIcon } from "lucide-react";
import { PageTitle } from "../title-page/title-page";
import { GithubCiSpinner } from "../ci-spinner/github-ci-spinner";
import { useAppSelector } from "@/redux/store";
import { cn } from "@/lib/utils";

export default function Home() {
    const whitelistResetInProgress = useAppSelector((state) => state.bot.whitelistResetInProgress);
    return (
        <div>
            <PageTitle title="Home" icon={HomeIcon} size="md" />
            <div className="p-5">
                <div className="flex items-center gap-2">
                    <GithubCiSpinner state={whitelistResetInProgress ? "start" : "stop"} stopVisual="ring" size={14} gapRatio={0.2} color="#22c55e" />
                    <p
                        className={cn(
                            "font-bold transition-[color,opacity] duration-300 ease-in-out",
                            whitelistResetInProgress ? "text-foreground opacity-100" : "text-muted-foreground opacity-70",
                        )}
                    >
                        White List Reset In Progress
                    </p>
                </div>
            </div>
        </div>
    );
}
