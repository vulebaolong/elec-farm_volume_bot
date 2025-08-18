import { TSide } from "@/types/base.type";
import { TPriority } from "@/types/priority-change.type";

/** Chọn side theo priority. Trả null nếu không hợp lệ để vào lệnh */
export function pickSideByPriority(isLong: boolean, isShort: boolean, priority: TPriority): TSide | null {
    switch (priority) {
        case "long":
            console.log(`ưu tiên long, isLong: ${isLong}`);
            return isLong ? "long" : null;
        case "short":
            console.log(`ưu tiên short, isShort: ${isShort}`);
            return isShort ? "short" : null;
        case "normal":
        default:
            // Giữ hành vi cũ: nếu cả 2 true thì ưu tiên long
            if (isLong && !isShort) {
                console.log(`normal => vào long`);
                return "long";
            }
            if (!isLong && isShort) {
                console.log(`normal => vào short`);
                return "short"
            };
            if (isLong && isShort) {
                console.log(`normal => vào long | isLong: ${isLong} | isShort: ${isShort}`);
                return "long";
            }
            return null; // cả 2 false -> bỏ
    }
}
