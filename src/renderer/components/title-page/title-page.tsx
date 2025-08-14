// components/page-title.tsx
import * as React from "react";
import type { LucideIcon } from "lucide-react";

// Nếu bạn có util cn của shadcn:
// import { cn } from '@/lib/utils';
const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type Size = "sm" | "md" | "lg";

const SIZE_MAP: Record<Size, { icon: string; text: string; gap: string; padding: string }> = {
    sm: { icon: "size-4", text: "text-lg", gap: "gap-1.5", padding: "p-3" },
    md: { icon: "size-5", text: "text-2xl", gap: "gap-2", padding: "p-5" },
    lg: { icon: "size-6", text: "text-3xl", gap: "gap-3", padding: "p-6" },
};

export interface PageTitleProps {
    title: string | React.ReactNode;
    icon?: LucideIcon; // truyền icon từ lucide-react, ví dụ: Settings
    actions?: React.ReactNode; // nút/toolbar bên phải (optional)
    size?: Size; // sm | md | lg (mặc định md)
    className?: string; // thêm class nếu cần
}

export function PageTitle({ title, icon: Icon, actions, size = "md", className }: PageTitleProps) {
    const s = SIZE_MAP[size];

    return (
        <div className={cn("flex items-center justify-between", s.padding, className)}>
            <div className={cn("flex items-center", s.gap)}>
                {Icon ? <Icon className={cn(s.icon, "shrink-0 text-muted-foreground")} /> : null}
                {typeof title === "string" ? <p className={cn("font-bold", s.text)}>{title}</p> : title}
            </div>

            {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
    );
}
