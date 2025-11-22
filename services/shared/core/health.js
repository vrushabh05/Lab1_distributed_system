/**
 * Shared Core: Health Check System
 * Comprehensive health monitoring for microservices
 */

/**
 * Health checker with liveness and readiness probes
 */
export class HealthChecker {
  constructor(serviceName, logger) {
    this.serviceName = serviceName;
    this.logger = logger;
    this.startTime = Date.now();
    this.checks = new Map();
  }
  
  /**
   * Register a health check function
   */
  registerCheck(name, checkFn) {
    this.checks.set(name, checkFn);
    this.logger.debug(`Registered health check: ${name}`);
  }
  
  /**
   * Liveness probe - is the service alive?
   * Returns immediately with basic status
   */
  async liveness() {
    return {
      alive: true,
      service: this.serviceName,
      uptime: this._getUptime(),
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Readiness probe - is the service ready to handle traffic?
   * Checks all dependencies (database, Kafka, etc.)
   */
  async readiness() {
    const results = {
      ready: true,
      service: this.serviceName,
      uptime: this._getUptime(),
      timestamp: new Date().toISOString(),
      checks: {}
    };
    
    // Run all registered health checks
    for (const [name, checkFn] of this.checks) {
      try {
        const checkResult = await checkFn();
        results.checks[name] = checkResult;
        
        // If any check is unhealthy, mark as not ready
        if (!checkResult.healthy) {
          results.ready = false;
        }
      } catch (error) {
        this.logger.error(`Health check failed: ${name}`, error);
        results.checks[name] = {
          healthy: false,
          error: error.message
        };
        results.ready = false;
      }
    }
    
    return results;
  }
  
  /**
   * Detailed health check with metrics
   */
  async detailed() {
    const ready = await this.readiness();
    
    return {
      ...ready,
      metrics: {
        uptime: this._getUptime(),
        memory: this._getMemoryUsage(),
        cpu: process.cpuUsage()
      }
    };
  }
  
  /**
   * Get service uptime in seconds
   */
  _getUptime() {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }
  
  /**
   * Get memory usage
   */
  _getMemoryUsage() {
    const used = process.memoryUsage();
    return {
      rss: `${Math.round(used.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(used.external / 1024 / 1024)}MB`
    };
  }
}

export const createHealthChecker = (serviceName, logger) => {
  return new HealthChecker(serviceName, logger);
};
