class Task {
    id: string;

    url: string;
    userAgent: string;
    msPerAttempt: number;
    maxAttempts: number;

    logs: Array<Log>;

    state: string;
    attemps: number;
    callback: (error: Error, task: Task) => void;
}