"use client";

import React, { useEffect, useImperativeHandle, useRef } from "react";

function getScrollParent(el: HTMLElement | null): HTMLElement {
    let node: HTMLElement | null = el;
    while (node && node !== document.body) {
        const { overflowY } = getComputedStyle(node);
        const isScrollable = (overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight;
        if (isScrollable) return node;
        node = node.parentElement;
    }
    // fallback: document scroller
    return (document.scrollingElement as HTMLElement) || document.documentElement;
}

function getOffsetTopWithin(el: HTMLElement, container: HTMLElement) {
    let top = 0;
    let node: HTMLElement | null = el;
    while (node && node !== container) {
        top += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
    }
    return top;
}

export const ScrollOnMount = React.forwardRef<
    HTMLDivElement,
    {
        offset?: number; // px bù trừ header sticky
        behavior?: ScrollBehavior; // 'smooth' | 'auto'
        delayMs?: number; // chờ layout xong
        className?: string;
    }
>(({ offset = 0, behavior = "smooth", delayMs = 0, className }, ref) => {
    const localRef = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => localRef.current as HTMLDivElement);

    useEffect(() => {
        const id = setTimeout(() => {
            const el = localRef.current;
            if (!el) return;

            const container = getScrollParent(el);
            const prefersReduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            const b = prefersReduced ? "auto" : behavior;

            // Nếu dùng offset => tự tính khoảng cách trong container
            if (offset) {
                const top = getOffsetTopWithin(el, container) - offset;
                container.scrollTo({ top, behavior: b });
            } else {
                // Không offset: scrollIntoView sẽ cuộn đúng container
                el.scrollIntoView({ behavior: b, block: "start", inline: "nearest" });
            }
        }, delayMs);

        return () => clearTimeout(id);
    }, [offset, behavior, delayMs]);

    return <div ref={localRef} className={className} aria-hidden />;
});
ScrollOnMount.displayName = "ScrollOnMount";
