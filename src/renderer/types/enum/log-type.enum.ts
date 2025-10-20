export enum ELogType {
    Silent = 0,
    All = 1,
    Trade = 2,
}

// Tuỳ chọn hiển thị cho Mantine Select (value phải là string)
export const logTypeOptions = [
  { value: String(ELogType.Silent), label: "Silent" },
  { value: String(ELogType.All),    label: "All" },
  { value: String(ELogType.Trade),  label: "Trade" },
] as const;