import { TSide } from "@/types/base.type";
import { TPriority } from "@/types/priority-change.type";

/** Chọn side theo priority. Trả null nếu không hợp lệ để vào lệnh */
export function pickSideByPriority(isLong: boolean, isShort: boolean, priority: TPriority): TSide | null {
    switch (priority) {
        case "long":
            return isLong ? "long" : null;
        case "short":
            return isShort ? "short" : null;
        case "normal":
        default:
            // Giữ hành vi cũ: nếu cả 2 true thì ưu tiên long
            if (isLong && !isShort) return "long";
            if (!isLong && isShort) return "short";
            if (isLong && isShort) return "long";
            return null; // cả 2 false -> bỏ
    }
}
