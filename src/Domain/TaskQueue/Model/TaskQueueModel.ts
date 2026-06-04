export type TaskQueueStatus = 'pending' | 'running' | 'done' | 'failed';

export interface TaskQueueItem {
    id: number;
    task: string;
    params: Record<string, any>;
    status: TaskQueueStatus;
    created_at: Date;
    started_at: Date | null;
    finished_at: Date | null;
    error: string | null;
}
