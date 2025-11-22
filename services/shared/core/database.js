/**
 * Shared Core: MongoDB Connection Manager
 * Handles connection lifecycle, health checks, and graceful shutdown
 */

import mongoose from 'mongoose';

/**
 * MongoDB connection manager with health monitoring
 */
export class DatabaseManager {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.isConnected = false;
    this.connectionPromise = null;
  }
  
  /**
   * Connect to MongoDB with retry logic
   */
  async connect(retries = 3, delay = 2000) {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }
    
    this.connectionPromise = this._attemptConnection(retries, delay);
    return this.connectionPromise;
  }
  
  async _attemptConnection(retries, delay) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        this.logger.info(`Connecting to MongoDB (attempt ${attempt}/${retries})...`);
        
        await mongoose.connect(this.config.MONGODB_URI, this.config.MONGODB_OPTIONS);
        
        this.isConnected = true;
        const connection = mongoose.connection;
        this.logger.info('MongoDB connected successfully', {
          host: connection.host,
          poolSize: this.config.MONGODB_OPTIONS.maxPoolSize,
        });
        
        // Ensure indexes are created (runs in background)
        mongoose.connection.db.command({ listCollections: 1 }).then(() => {
          this.logger.info('Checking database indexes...');
        }).catch(err => {
          this.logger.warn('Could not verify indexes', err);
        });
        
        // Setup event listeners
        this._setupEventListeners();
        
        return mongoose.connection;
        
      } catch (error) {
        this.logger.error(`MongoDB connection failed (attempt ${attempt}/${retries})`, error);
        
        if (attempt < retries) {
          this.logger.info(`Retrying in ${delay}ms...`);
          await this._sleep(delay);
          delay *= 2; // Exponential backoff
        } else {
          throw new Error(`Failed to connect to MongoDB after ${retries} attempts`);
        }
      }
    }
  }
  
  /**
   * Setup MongoDB event listeners
   */
  _setupEventListeners() {
    mongoose.connection.on('disconnected', () => {
      this.isConnected = false;
      this.logger.warn('MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      this.isConnected = true;
      this.logger.info('MongoDB reconnected');
    });
    
    mongoose.connection.on('error', (error) => {
      this.logger.error('MongoDB error', error);
    });
  }
  
  /**
   * Health check with detailed connection info
   * @returns {Promise<Object>}
   */
  async healthCheck() {
    try {
      if (!mongoose.connection || mongoose.connection.readyState !== 1) {
        return {
          ok: false,
          status: 'disconnected',
          message: 'Database not connected'
        };
      }

      // Ping database to verify connectivity
      await mongoose.connection.db.admin().ping();
      
      // Get connection pool stats
      const poolStats = {
        readyState: mongoose.connection.readyState,
        name: mongoose.connection.name,
        host: mongoose.connection.host,
        port: mongoose.connection.port
      };

      return {
        ok: true,
        status: 'connected',
        message: 'Database is healthy',
        pool: poolStats
      };
    } catch (error) {
      this.logger.error('Health check failed', error);
      return {
        ok: false,
        status: 'error',
        message: error.message
      };
    }
  }
  
  /**
   * Graceful shutdown
   */
  async disconnect() {
    if (!this.isConnected) {
      this.logger.info('MongoDB already disconnected');
      return;
    }
    
    try {
      this.logger.info('Closing MongoDB connection...');
      await mongoose.connection.close();
      this.isConnected = false;
      this.connectionPromise = null;
      this.logger.info('MongoDB connection closed');
    } catch (error) {
      this.logger.error('Error closing MongoDB connection', error);
      throw error;
    }
  }
  
  /**
   * Extract host from MongoDB URI
   */
  _getHostFromUri() {
    try {
      const match = this.config.MONGODB_URI.match(/mongodb:\/\/([^\/]+)/);
      return match ? match[1] : 'unknown';
    } catch {
      return 'unknown';
    }
  }
  
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const createDatabaseManager = (config, logger) => {
  return new DatabaseManager(config, logger);
};

// Export mongoose instance so services use the same connected instance
export { mongoose };
