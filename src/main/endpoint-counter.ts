// gate-rate-counter.ts
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import { pickRule } from "./gate/gate-rate-rules";

export type Ctx = { uid?: string };

export type CountEntry = {
    id: string; // rule id (vd: futures.place)
    key: string; // bucket key (vd: place:<uid>, priv:<uid>:<path> ...)
    count: number; // ĐẾM TRONG CỬA SỔ HIỆN TẠI
    createdAt: string; // khi bucket xuất hiện lần đầu (giữ nguyên)
    updatedAt: string; // cập nhật mỗi lần bump
    windowStartAt: string; // mốc bắt đầu cửa sổ hiện tại (ISO)
    limit?: number; // metadata từ rule
    windowMs?: number; // metadata từ rule
    basis?: "IP" | "UID"; // metadata từ rule
};

export type BumpStatus = {
    id: string;
    key: string;
    count: number; // sau khi tăng
    limit: number | null; // null nếu rule không có limit (hiếm)
    windowMs: number | null;
    windowStartedAt: number; // epoch ms
    resetInMs: number | null; // còn bao lâu hết cửa sổ; null nếu không biết windowMs
    exceeded: boolean; // true nếu count > limit
    near: boolean; // true nếu chạm 90% limit trong cửa sổ
};

export class GateRateCounter {
    private filePath: string;
    private data = new Map<string, CountEntry>(); // key = `${id}|${key}`

    constructor(filename = "gate-rate-counts.json") {
        const dir = app.getPath("logs");
        this.filePath = path.join(dir, filename);
        fs.mkdirSync(dir, { recursive: true });
        // load nếu có sẵn
        try {
            const txt = fs.readFileSync(this.filePath, "utf8");
            const obj = JSON.parse(txt) as Record<string, CountEntry>;
            for (const [k, v] of Object.entries(obj)) {
                // fallback nếu file cũ chưa có windowStartAt
                if (!v.windowStartAt) v.windowStartAt = v.updatedAt || v.createdAt || new Date().toISOString();
                this.data.set(k, v);
            }
        } catch {}
    }

    getPath() {
        return this.filePath;
    }

    snapshot() {
        const out: Record<string, CountEntry> = {};
        for (const [k, v] of this.data) out[k] = { ...v };
        return out;
    }

    async clear() {
        this.data.clear();
        await fsp.writeFile(this.filePath, "{}\n", "utf8");
    }

    /**
     * Bump theo METHOD + URL dựa vào gate-rate-rules.
     * - Tự reset count nếu đã quá windowMs
     * - Ghi file ngay sau khi cập nhật
     * - Trả về status để quyết định backoff / throttle
     */
    bumpFromHttp(method: string, urlStr: string, ctx: Ctx = {}): BumpStatus | null {
        const rule = pickRule(method, urlStr);
        if (!rule) return null; // không thuộc rule → bỏ

        const url = new URL(urlStr);
        const bucket = rule.bucketKey(method.toUpperCase(), url, ctx);
        return this.bump(rule.id, bucket, { limit: rule.limit, windowMs: rule.windowMs, basis: rule.basis });
    }

    /** Core logic: reset theo cửa sổ & tăng đếm; ghi file NGAY */
    private bump(id: string, key: string, meta?: { limit?: number; windowMs?: number; basis?: "IP" | "UID" }): BumpStatus {
        const nowMs = Date.now();
        const nowIso = new Date(nowMs).toISOString();
        const k = `${id}|${key}`;
        const limit = meta?.limit ?? null;
        const windowMs = meta?.windowMs ?? null;

        let entry = this.data.get(k);

        if (!entry) {
            entry = {
                id,
                key,
                count: 0,
                createdAt: nowIso,
                updatedAt: nowIso,
                windowStartAt: nowIso,
                limit: meta?.limit,
                windowMs: meta?.windowMs,
                basis: meta?.basis,
            };
            this.data.set(k, entry);
        } else {
            // cập nhật metadata nếu có thay đổi
            if (meta?.limit != null) entry.limit = meta.limit;
            if (meta?.windowMs != null) entry.windowMs = meta.windowMs;
            if (meta?.basis) entry.basis = meta.basis;
        }

        // Kiểm tra cửa sổ
        const thisWindowMs = entry.windowMs ?? windowMs ?? null;
        let windowStartMs = Date.parse(entry.windowStartAt);
        if (Number.isNaN(windowStartMs)) windowStartMs = nowMs;

        if (thisWindowMs != null && thisWindowMs > 0) {
            // Nếu đã quá cửa sổ, reset count & chuyển cửa sổ mới
            if (nowMs - windowStartMs >= thisWindowMs) {
                entry.count = 0;
                entry.windowStartAt = nowIso;
                windowStartMs = nowMs;
            }
        }

        // Tăng count cho cửa sổ hiện tại
        entry.count += 1;
        entry.updatedAt = nowIso;

        // Tính status
        const resetInMs = thisWindowMs != null ? Math.max(0, thisWindowMs - (nowMs - windowStartMs)) : null;
        const exceeded = limit != null ? entry.count > limit : false;
        const near = limit != null ? entry.count >= Math.floor(limit * 0.9) : false;

        // Ghi file NGAY (overwrite)
        void this.writeNow();

        return {
            id,
            key,
            count: entry.count,
            limit,
            windowMs: thisWindowMs,
            windowStartedAt: windowStartMs,
            resetInMs,
            exceeded,
            near,
        };
    }

    private async writeNow() {
        const obj: Record<string, CountEntry> = {};
        for (const [k, v] of this.data) obj[k] = v;
        await fsp.writeFile(this.filePath, JSON.stringify(obj, null, 2), "utf8");
    }
}
