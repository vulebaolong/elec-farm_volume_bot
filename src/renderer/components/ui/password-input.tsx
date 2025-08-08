import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export function PasswordInput(props: React.ComponentProps<typeof Input>) {
    const [show, setShow] = useState(false);

    return (
        <div className="relative">
            <Input type={show ? "text" : "password"} {...props} />
            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 p-1" onClick={() => setShow((s) => !s)} tabIndex={-1}>
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
        </div>
    );
}
