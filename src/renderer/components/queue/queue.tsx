"use client";

import { Card, CardContent } from "@/components/ui/card";

export type VisualTask = {
    id: string;
    symbol: string;
    delay: number; // Tổng thời gian delay
};

type Props = {
    queue: VisualTask[];
    setQueue: React.Dispatch<React.SetStateAction<VisualTask[]>>;
};

export default function Queue({ queue, setQueue }: Props) {
    return (
        <div className="p-4 h-[200px] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Queue Progress: {queue.length}</h2>
            <div className="space-y-3">
                {queue.map((task) => (
                    <Card key={task.id} className="bg-muted">
                        <CardContent className=" space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="font-semibold text-sm">{task.symbol}</div>
                                {/* <Badge variant="outline" className="text-xs">
                  {task.started ? 'Running' : 'Waiting'}
                </Badge> */}
                            </div>
                            {/* <Progress
                value={
                  task.started
                    ? ((task.delay - task.remaining) / task.delay) * 100
                    : 0
                }
              /> */}
                            {/* <div className="text-right text-xs text-muted-foreground">
                {task.remaining > 0
                  ? `${(task.remaining / 1000).toFixed(1)}s còn lại`
                  : 'Đã xử lý'}
              </div> */}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
