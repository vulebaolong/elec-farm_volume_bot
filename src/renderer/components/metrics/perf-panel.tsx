// renderer/components/PerfPanel.tsx
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useMetrics } from "@/hooks/useMetrics";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function PerfPanel() {
    const { latest, series, leakHint } = useMetrics(2000, 150);
    if (!latest) return <div className="text-sm text-muted-foreground">Đang thu thập số liệu…</div>;

    const cpu = Math.min(100, Math.max(0, latest.main.cpu.percentCPUUsage ?? 0));
    const rssKB =
        latest.main.mem.residentSet ??
        latest.main.mem.workingSetSize ?? // Windows cũ
        latest.main.mem.rss ?? // fallback khác (nếu có)
        0;
    const rssMb = Math.round(rssKB / 1024);
    const heapMb = Math.round(latest.main.heap.heapUsed / (1024 * 1024));
    const loopLag = latest.main.eventLoop.p95;

    const chartData = series.map((s) => ({
        ts: new Date(s.ts).toLocaleTimeString(),
        cpu: +(s.main.cpu.percentCPUUsage ?? 0).toFixed(1),
        heap: +(s.main.heap.heapUsed / (1024 * 1024)).toFixed(1),
        lag: +s.main.eventLoop.p95.toFixed(2),
    }));

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
                <CardHeader>
                    <CardTitle>CPU (main)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="text-2xl font-semibold">{cpu.toFixed(1)}%</div>
                        <Badge variant={cpu > 80 ? "destructive" : cpu > 60 ? "secondary" : "default"}>
                            {cpu > 80 ? "Cao" : cpu > 60 ? "Trung bình" : "Tốt"}
                        </Badge>
                    </div>
                    <Progress value={cpu} />
                    <div className="h-24">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <XAxis dataKey="ts" hide />
                                <YAxis hide />
                                <Tooltip />
                                <Line type="monotone" dataKey="cpu" dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Memory</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">RSS (OS):</div>
                        <div className="font-medium">{rssMb} MB</div>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">Heap (JS):</div>
                        <div className="font-medium">{heapMb} MB</div>
                    </div>
                    <div className="h-24">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <XAxis dataKey="ts" hide />
                                <YAxis hide />
                                <Tooltip />
                                <Line type="monotone" dataKey="heap" dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    {leakHint && <div className="text-xs text-amber-600">{leakHint}</div>}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Event-loop lag (p95)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="text-2xl font-semibold">{loopLag.toFixed(2)} ms</div>
                        <Badge variant={loopLag > 100 ? "destructive" : loopLag > 30 ? "secondary" : "default"}>
                            {loopLag > 100 ? "Lag cao" : loopLag > 30 ? "Trung bình" : "Mượt"}
                        </Badge>
                    </div>
                    <div className="h-24">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <XAxis dataKey="ts" hide />
                                <YAxis hide />
                                <Tooltip />
                                <Line type="monotone" dataKey="lag" dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="text-xs text-muted-foreground">
                        WebContents: {latest.app.webContents} • Processes: {latest.app.processes} • IPC listeners: {latest.main.ipcListeners}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
