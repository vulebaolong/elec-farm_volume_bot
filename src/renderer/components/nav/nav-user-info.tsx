import { useAppSelector } from "@/redux/store";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

export default function NavUserInfo() {
    const info = useAppSelector((state) => state.user.info);

    return (
        <div className="flex items-center gap-2 py-1.5 text-left text-sm">
            <Avatar className="h-8 w-8 rounded-full">
                <AvatarImage src={info?.avatar || ""} alt={info?.fullName || ""} />
                <AvatarFallback className="rounded-lg">{info?.fullName?.slice(0, 2)?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{info?.fullName}</span>
                <span className="truncate text-xs text-muted-foreground">{info?.email}</span>
            </div>
        </div>
    );
}
