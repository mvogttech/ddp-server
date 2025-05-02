/**
 * Metrics collection utility using Prometheus.
 */
export declare class Metrics {
    private registry;
    private counters;
    private gauges;
    constructor();
    /**
     * Increments a counter metric.
     * @param name - Metric name.
     * @param labels - Optional labels.
     */
    increment(name: string, labels?: Record<string, string>): void;
    /**
     * Sets a gauge metric.
     * @param name - Metric name.
     * @param value - Gauge value.
     * @param labels - Optional labels.
     */
    gauge(name: string, value: number, labels?: Record<string, string>): void;
    /**
     * Returns the current metrics in Prometheus format.
     * @returns Metrics string.
     */
    getMetrics(): Promise<string>;
}
