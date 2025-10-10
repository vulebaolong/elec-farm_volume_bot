import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import React, { ReactNode, useEffect, useRef } from "react";

type AppendLoadingProps = {
    /** đang fetch (trạng thái chung) */
    isLoading: boolean;
    /** danh sách hiện tại rỗng (chưa có item nào) */
    isEmpty: boolean;
    /** có lỗi khi fetch lần gần nhất */
    isError: boolean;

    /** loader cho lần tải đầu tiên (khi isEmpty && isLoading) */
    initialLoadingComponent?: ReactNode;
    /** hiển thị khi không có dữ liệu (isEmpty || isError) && !isLoading */
    noDataComponent?: ReactNode;

    /** loader đặt ở top (khi appendSide='top' & đang loading & có data) */
    loadingIndicatorTop?: ReactNode;
    /** loader đặt ở bottom (khi appendSide='bottom' & đang loading & có data) */
    loadingIndicatorBottom?: ReactNode;
    /** Giữ tương thích: nếu bạn truyền footerLoadingComponent cũ vẫn hoạt động (bottom) */
    footerLoadingComponent?: ReactNode;

    /** nội dung danh sách */
    children: ReactNode;

    /**
     * Vị trí append: 'top' để load thêm ở đầu (chat cũ),
     * 'bottom' để load thêm ở cuối (feed).
     */
    appendSide?: "top" | "bottom";

    /** callback khi chạm sentinel */
    onLoadMore?: () => void;

    /**
     * scroll container làm root cho IntersectionObserver.
     * Ví dụ: ref đến ScrollArea viewport / div có overflow.
     */
    containerRef: React.RefObject<HTMLElement | null>;

    /** tinh chỉnh */
    threshold?: number; // default 0.1
    rootMargin?: string; // default "0px"
    debug?: boolean;
};

export function AppendLoading({
    debug = false,
    isLoading,
    isEmpty,
    isError,
    initialLoadingComponent,
    noDataComponent,
    loadingIndicatorTop,
    loadingIndicatorBottom,
    // backward-compat (bottom)
    footerLoadingComponent,
    children,
    appendSide = "bottom",
    onLoadMore,
    containerRef,
    threshold = 0.1,
    rootMargin = "0px",
}: AppendLoadingProps) {
    const sentinelRef = useRef<HTMLDivElement | null>(null);

    // trạng thái hiển thị
    const showInitialLoading = isLoading && isEmpty && !isError;
    const showNoData = (isEmpty || isError) && !isLoading;
    const showEdgeLoading = isLoading && !isEmpty && !isError; // có data rồi, đang kéo thêm

    if (debug) {
        // eslint-disable-next-line no-console
        console.log({ appendSide, showInitialLoading, showNoData, showEdgeLoading });
    }

    // Observer cho sentinel
    useEffect(() => {
        const rootEl = containerRef?.current;
        const target = sentinelRef.current;
        if (!rootEl || !target || !onLoadMore || typeof IntersectionObserver === "undefined") return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    if (debug) console.log(`[AppendLoading] ${appendSide} sentinel visible -> onLoadMore()`);
                    onLoadMore();
                }
            },
            { root: rootEl, rootMargin, threshold }
        );

        observer.observe(target);
        return () => observer.disconnect();
    }, [appendSide, onLoadMore, containerRef, rootMargin, threshold, debug]);

    // 1) lần đầu: chỉ hiển thị loader initial
    if (showInitialLoading) {
        return <>{initialLoadingComponent ?? <Loader2 className="h-5 w-5 animate-spin" />}</>;
    }

    // 2) không có dữ liệu (hoặc lỗi) và không loading
    if (showNoData) {
        return <>{noDataComponent ?? <p className="text-muted-foreground text-sm">No Data</p>}</>;
    }

    // 3) đã có dữ liệu
    const TopLoader = loadingIndicatorTop ?? (appendSide === "top" ? <Loader2 className="h-5 w-5 animate-spin mx-auto my-2" /> : null);

    const BottomLoader =
        loadingIndicatorBottom ??
        footerLoadingComponent ?? // BC
        (appendSide === "bottom" ? <Loader2 className="h-5 w-5 animate-spin mx-auto my-2" /> : null);

    return (
        <>
            {/* appendSide = 'top' thì sentinel đặt trước children */}
            {appendSide === "top" && (
                <>
                    {showEdgeLoading && TopLoader}
                    <div ref={sentinelRef} className={cn("h-px w-full", debug && "bg-red-500")} aria-hidden />
                </>
            )}

            {children}

            {/* appendSide = 'bottom' thì sentinel đặt sau children */}
            {appendSide === "bottom" && (
                <>
                    {showEdgeLoading && BottomLoader}
                    <div ref={sentinelRef} className={cn("h-px w-full", debug && "bg-blue-500")} aria-hidden />
                </>
            )}
        </>
    );
}
