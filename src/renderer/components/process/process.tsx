import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GithubCiSpinner } from "../ci-spinner/github-ci-spinner";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/redux/store";

export default function Process() {
    const whitelistResetInProgress = useAppSelector((state) => state.bot.whitelistResetInProgress);

    return (
        <div className="px-5">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Process System</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                        <GithubCiSpinner
                            state={whitelistResetInProgress ? "start" : "stop"}
                            stopVisual="ring"
                            size={14}
                            gapRatio={0.2}
                            color="#22c55e"
                        />
                        <p
                            className={cn(
                                "transition-[color,opacity] duration-300 ease-in-out",
                                whitelistResetInProgress ? "text-foreground opacity-100" : "text-muted-foreground opacity-70",
                            )}
                        >
                            White List Reset In Progress
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
