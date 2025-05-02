"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Metrics = void 0;
const prom_client_1 = require("prom-client");
/**
 * Metrics collection utility using Prometheus.
 */
class Metrics {
    constructor() {
        this.counters = new Map();
        this.gauges = new Map();
        this.registry = new prom_client_1.Registry();
    }
    /**
     * Increments a counter metric.
     * @param name - Metric name.
     * @param labels - Optional labels.
     */
    increment(name, labels = {}) {
        let counter = this.counters.get(name);
        if (!counter) {
            counter = new prom_client_1.Counter({
                name: `ddp_${name.replace(/\./g, '_')}`,
                help: `DDP ${name} counter`,
                labelNames: Object.keys(labels),
                registers: [this.registry],
            });
            this.counters.set(name, counter);
        }
        counter.inc(labels);
    }
    /**
     * Sets a gauge metric.
     * @param name - Metric name.
     * @param value - Gauge value.
     * @param labels - Optional labels.
     */
    gauge(name, value, labels = {}) {
        let gauge = this.gauges.get(name);
        if (!gauge) {
            gauge = new prom_client_1.Gauge({
                name: `ddp_${name.replace(/\./g, '_')}`,
                help: `DDP ${name} gauge`,
                labelNames: Object.keys(labels),
                registers: [this.registry],
            });
            this.gauges.set(name, gauge);
        }
        gauge.set(labels, value);
    }
    /**
     * Returns the current metrics in Prometheus format.
     * @returns Metrics string.
     */
    async getMetrics() {
        return this.registry.metrics();
    }
}
exports.Metrics = Metrics;
//# sourceMappingURL=metrics.js.map