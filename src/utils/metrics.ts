import { Registry, Counter, Gauge } from 'prom-client';

/**
 * Metrics collection utility using Prometheus.
 */
export class Metrics {
  private registry: Registry;
  private counters: Map<string, Counter> = new Map();
  private gauges: Map<string, Gauge> = new Map();

  constructor() {
    this.registry = new Registry();
  }

  /**
   * Increments a counter metric.
   * @param name - Metric name.
   * @param labels - Optional labels.
   */
  increment(name: string, labels: Record<string, string> = {}): void {
    let counter = this.counters.get(name);
    if (!counter) {
      counter = new Counter({
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
  gauge(
    name: string,
    value: number,
    labels: Record<string, string> = {}
  ): void {
    let gauge = this.gauges.get(name);
    if (!gauge) {
      gauge = new Gauge({
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
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
