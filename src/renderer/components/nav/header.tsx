import { TITLE } from "@/constant/app.constant";

export function Header() {
    return (
        <header className="bg-background sticky top-0 z-50 flex w-full items-center border-b">
            <div className="flex h-[var(--header-height)] w-full items-center gap-2 px-4">
                <p className="text-sm font-bold bg-gradient-to-r from-[#93AEFF] to-[#FFB7B8] bg-clip-text text-transparent">{TITLE}</p>
            </div>
        </header>
    );
}
