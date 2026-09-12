interface FourierDomRuntime {
    initialize(input: Readonly<Record<string, unknown>>): Promise<void>;
    setTime(milliseconds: number): Promise<void>;
    setMotionActive(active: boolean): Promise<void>;
}
declare global {
    interface Window {
        __fourierDomTimeline?: FourierDomRuntime;
    }
}
export {};
//# sourceMappingURL=preview-app.d.ts.map