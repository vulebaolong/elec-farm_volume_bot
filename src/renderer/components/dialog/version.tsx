import { IS_PRODUCTION } from "@/constant/app.constant";
import { TVersions } from "@/types/version.type";
import { Badge } from "../ui/badge";

export default function Version({ current, latest }: TVersions) {
    return (
        <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-muted-foreground">Version: {current}</p>
            {latest && latest !== current && <p className="text-xs text-green-500">New available: {latest}</p>}
            <Badge variant="outline">
                <p className="text-xs text-muted-foreground">{IS_PRODUCTION ? "Production" : "Development"}</p>
            </Badge>
        </div>
    );
}
