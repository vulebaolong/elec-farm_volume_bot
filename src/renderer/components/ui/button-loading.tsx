import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface ButtonLoadingProps extends React.ComponentProps<typeof Button> {
    loading: boolean;
    children: React.ReactNode;
}

export function ButtonLoading({ loading, children, className, ...props }: ButtonLoadingProps) {
    return (
        <Button {...props} disabled={loading || props.disabled} className={`relative overflow-hidden ${className}`}>
            {/* Loader */}
            {
                <span
                    className={`
            absolute left-0 top-0 w-full h-full flex items-center justify-center
            transition-all duration-300
            ${loading ? "translate-y-0 opacity-100" : "-translate-y-8 opacity-0"}
            pointer-events-none
          `}
                >
                    {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                </span>
            }

            {/* Content */}
            <span
                className={`
          absolute left-0 top-0 w-full h-full flex items-center justify-center gap-2
          transition-all duration-300 
          ${loading ? "translate-y-8 opacity-0" : "translate-y-0 opacity-100"}
          pointer-events-none
        `}
            >
                {children}
            </span>
        </Button>
    );
}
