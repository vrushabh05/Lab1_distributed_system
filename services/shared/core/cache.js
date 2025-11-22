/**
 * Shared Core: Redis Cache Manager
 * Provides caching functionality with TTL support
 */

import { createClient } from 'redis';

export class CacheManager {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.client = null;
    this.isConnected = false;
    this.defaultTTL = config.CACHE_TTL || 300; // 5 minutes default
  }

  /**
   * Connect to Redis
   */
  async connect() {
    if (!this.config.REDIS_ENABLED) {
      this.logger.info('Redis caching is disabled');
      return;
    }

    try {
      this.client = createClient({
        socket: {
          host: this.config.REDIS_HOST || 'localhost',
          port: this.config.REDIS_PORT || 6379,
          connectTimeout: 5000
        }
      });

      this.client.on('error', (err) => {
        this.logger.error('Redis client error', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        this.logger.info('Redis client connecting...');
      });

      this.client.on('ready', () => {
        this.logger.info('Redis client ready');
        this.isConnected = true;
      });

      this.client.on('reconnecting', () => {
        this.logger.warn('Redis client reconnecting...');
      });

      await this.client.connect();
      
      this.logger.info('Redis cache connected', {
        host: this.config.REDIS_HOST,
        port: this.config.REDIS_PORT
      });

    } catch (error) {
      this.logger.error('Failed to connect to Redis', error);
      this.isConnected = false;
      // Don't throw - allow service to run without cache
    }
  }

  /**
   * Get value from cache
   */
  async get(key) {
    if (!this.isConnected || !this.client) {
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (value) {
        this.logger.debug('Cache hit', { key });
        return JSON.parse(value);
      }
      this.logger.debug('Cache miss', { key });
      return null;
    } catch (error) {
      this.logger.error('Cache get error', error, { key });
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key, value, ttl = null) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      const expiresIn = ttl || this.defaultTTL;
      
      await this.client.setEx(key, expiresIn, serialized);
      
      this.logger.debug('Cache set', { key, ttl: expiresIn });
      return true;
    } catch (error) {
      this.logger.error('Cache set error', error, { key });
      return false;
    }
  }

  /**
   * Delete key from cache
   */
  async del(key) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      await this.client.del(key);
      this.logger.debug('Cache delete', { key });
      return true;
    } catch (error) {
      this.logger.error('Cache delete error', error, { key });
      return false;
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async delPattern(pattern) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        this.logger.debug('Cache pattern delete', { pattern, count: keys.length });
      }
      return true;
    } catch (error) {
      this.logger.error('Cache pattern delete error', error, { pattern });
      return false;
    }
  }

  /**
   * Clear all cache
   */
  async flush() {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      await this.client.flushAll();
      this.logger.info('Cache flushed');
      return true;
    } catch (error) {
      this.logger.error('Cache flush error', error);
      return false;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect() {
    if (this.client) {
      try {
        await this.client.quit();
        this.isConnected = false;
        this.logger.info('Redis cache disconnected');
      } catch (error) {
        this.logger.error('Error disconnecting from Redis', error);
      }
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    if (!this.config.REDIS_ENABLED) {
      return {
        healthy: true,
        enabled: false
      };
    }

    try {
      if (!this.isConnected || !this.client) {
        return {
          healthy: false,
          enabled: true,
          error: 'Not connected'
        };
      }

      await this.client.ping();
      
      return {
        healthy: true,
        enabled: true,
        connected: this.isConnected
      };
    } catch (error) {
      return {
        healthy: false,
        enabled: true,
        error: error.message
      };
    }
  }
}

export default CacheManager;
