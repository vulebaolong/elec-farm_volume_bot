import { useLoginFalse, useLoginTrue } from "@/api/tanstack/user.tanstack";
import { TUser } from "@/types/user.type";
import { Switch } from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import { useDebouncedCallback } from "@mantine/hooks";

type TProps = {
    userId: TUser["id"];
    initial?: boolean;
    debounceMs?: number;
};

export default function UserLoginSwitch({ userId, initial = false, debounceMs = 300 }: TProps) {
    const addBookmark = useLoginTrue();
    const removeBookmark = useLoginFalse();

    // UI state (optimistic)
    const [isLoginAllowed, setIsLoginAllowed] = useState<boolean>(initial);

    // lưu “trạng thái người dùng muốn” gần nhất
    const desiredRef = useRef<boolean>(initial);
    useEffect(() => {
        desiredRef.current = isLoginAllowed;
    }, [isLoginAllowed]);

    // chống race: chỉ nhận kết quả của lần commit mới nhất
    const seqRef = useRef(0);

    // Debounce 300ms: chỉ gọi API với trạng thái cuối cùng
    const commit = useDebouncedCallback(
        async () => {
            const desired = desiredRef.current;
            const seq = ++seqRef.current;

            try {
                if (desired) {
                    await addBookmark.mutateAsync({ userId });
                } else {
                    await removeBookmark.mutateAsync({ userId });
                }
                // chỉ áp dụng kết quả nếu đây là commit mới nhất
                if (seq !== seqRef.current) return;
                // (optional) toast.success(desired ? "Bookmarked" : "Unbookmarked");
            } catch (e) {
                if (seq !== seqRef.current) return; // kết quả cũ -> bỏ
                // Revert UI khi lỗi
                setIsLoginAllowed((prev) => !prev);
                // (optional) toast.error("Update bookmark failed");
            }
        },
        {
            delay: debounceMs,
            leading: false,
            flushOnUnmount: true,
        },
    );

    const onClick = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        // Toggle UI ngay, ghi nhận “ý định” rồi để debounce commit
        setIsLoginAllowed((prev) => {
            const next = !prev;
            desiredRef.current = next;
            commit();
            return next;
        });
    };

    return (
        <Switch
            onChange={(e) => {
                onClick(e);
            }}
            size="xs"
            checked={isLoginAllowed}
        />
    );
}
