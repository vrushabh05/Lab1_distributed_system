/**
 * Shared Core: Kafka Manager with Circuit Breaker
 * Handles Kafka connection lifecycle, circuit breaker pattern, and graceful degradation
 */

import { Kafka, logLevel } from 'kafkajs';

/**
 * Circuit breaker states
 */
const CircuitState = {
  CLOSED: 'CLOSED',     // Normal operation
  OPEN: 'OPEN',         // Failing, reject requests
  HALF_OPEN: 'HALF_OPEN' // Testing if recovered
};

/**
 * Circuit breaker for Kafka operations
 */
class CircuitBreaker {
  constructor(config = {}) {
    this.failureThreshold = config.failureThreshold || 5;
    this.successThreshold = config.successThreshold || 2;
    this.timeout = config.timeout || 60000; // 1 minute

    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
  }

  async execute(fn) {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = CircuitState.HALF_OPEN;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
      }
    }
  }

  onFailure() {
    this.failureCount++;
    this.successCount = 0;

    if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.timeout;
    }
  }

  getState() {
    return this.state;
  }
}

/**
 * Kafka manager with circuit breaker and graceful degradation
 */
export class KafkaManager {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.kafka = null;
    this.producer = null;
    this.consumer = null;
    this.isConnected = false;
    this.enabled = config.KAFKA_ENABLED !== false; // Enable by default unless explicitly disabled
    // Fix: Prioritize KAFKA_BROKER env var and handle comma-separated list
    const brokerList = config.KAFKA_BROKER || config.KAFKA_BROKERS || 'localhost:9092';
    this.brokers = brokerList.split(',').map(b => b.trim());
    this.topicHandlers = new Map(); // Store topic handlers
    this.consumerRunning = false; // Track if consumer.run() was called
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000
    });
  }

  /**
   * Initialize Kafka client with retry logic
   */
  initialize() {
    if (!this.enabled) {
      this.logger.warn('Kafka is disabled');
      return;
    }

    try {
      this.kafka = new Kafka({
        clientId: this.config.KAFKA_CLIENT_ID,
        brokers: this.brokers,
        connectionTimeout: this.config.KAFKA_CONNECTION_TIMEOUT,
        requestTimeout: this.config.KAFKA_REQUEST_TIMEOUT,
        retry: {
          initialRetryTime: 300,
          retries: 8,
          maxRetryTime: 30000,
          multiplier: 2,
          factor: 0.2
        },
        logLevel: logLevel.ERROR,
      });

      this.logger.info('Kafka client initialized', {
        broker: this.brokers[0],
        clientId: this.config.KAFKA_CLIENT_ID,
      });
    } catch (error) {
      this.logger.error('Kafka initialization failed', error);
      this.enabled = false;
    }
  }

  /**
   * Create and connect producer
   */
  async createProducer() {
    if (!this.enabled || !this.kafka) {
      this.logger.warn('Kafka disabled or not initialized - producer not created');
      return null;
    }

    try {
      await this.circuitBreaker.execute(async () => {
        this.producer = this.kafka.producer();
        await this.producer.connect();
        this.isConnected = true;
        this.logger.info('Kafka producer connected');
      });

      return this.producer;
    } catch (error) {
      this.logger.error('Failed to create Kafka producer', error);
      return null;
    }
  }

  /**
   * Create and connect consumer
   */
  async createConsumer(groupId = null) {
    if (!this.enabled || !this.kafka) {
      this.logger.warn('Kafka disabled or not initialized - consumer not created');
      return null;
    }

    try {
      await this.circuitBreaker.execute(async () => {
        this.consumer = this.kafka.consumer({
          groupId: groupId || this.config.KAFKA_GROUP_ID
        });
        await this.consumer.connect();
        this.isConnected = true;
        this.logger.info('Kafka consumer connected', {
          groupId: groupId || this.config.KAFKA_GROUP_ID
        });
      });

      return this.consumer;
    } catch (error) {
      this.logger.error('Failed to create Kafka consumer', error);
      return null;
    }
  }

  /**
   * Send message to topic (with circuit breaker)
   */
  async sendMessage(topic, message, key = null) {
    if (!this.config.KAFKA_ENABLED) {
      this.logger.debug('Kafka disabled - message not sent', { topic });
      return false;
    }

    if (!this.producer) {
      this.logger.warn('Kafka producer not initialized', { topic });
      return false;
    }

    try {
      await this.circuitBreaker.execute(async () => {
        await this.producer.send({
          topic,
          messages: [{
            key: key || null,
            value: JSON.stringify(message)
          }]
        });
      });

      this.logger.debug('Message sent to Kafka', { topic, key });
      return true;

    } catch (error) {
      this.logger.error('Failed to send Kafka message', error, { topic, key });
      return false;
    }
  }

  /**
   * Subscribe to topic and process messages
   */
  async subscribe(topic, handler) {
    if (!this.config.KAFKA_ENABLED) {
      this.logger.warn('Kafka disabled - not subscribing', { topic });
      return;
    }

    if (!this.consumer) {
      throw new Error('Kafka consumer not initialized');
    }

    try {
      // Store the handler for this topic
      this.topicHandlers.set(topic, handler);

      // Subscribe to the topic (must be done before consumer.run())
      await this.consumer.subscribe({ topic, fromBeginning: false });
      this.logger.info('Subscribed to Kafka topic', { topic });

    } catch (error) {
      this.logger.error('Failed to subscribe to Kafka topic', error, { topic });
      throw error;
    }
  }

  /**
   * Start consuming messages from all subscribed topics
   * This should be called after all subscribe() calls are made
   */
  async startConsumer() {
    if (!this.config.KAFKA_ENABLED) {
      this.logger.warn('Kafka disabled - not starting consumer');
      return;
    }

    if (!this.consumer) {
      throw new Error('Kafka consumer not initialized');
    }

    if (this.consumerRunning) {
      this.logger.warn('Consumer already running');
      return;
    }

    try {
      this.consumerRunning = true;
      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const data = JSON.parse(message.value.toString());
            this.logger.debug('Received Kafka message', {
              topic,
              partition,
              offset: message.offset
            });

            // Get handler for this topic and execute it
            const handler = this.topicHandlers.get(topic);
            if (handler) {
              await handler(data);
            } else {
              this.logger.warn('No handler found for topic', { topic });
            }

          } catch (error) {
            this.logger.error('Error processing Kafka message', error, {
              topic,
              partition,
              offset: message.offset
            });
          }
        }
      });

      this.logger.info('Kafka consumer started', {
        topics: Array.from(this.topicHandlers.keys())
      });

    } catch (error) {
      this.logger.error('Failed to start Kafka consumer', error);
      this.consumerRunning = false;
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    if (!this.config.KAFKA_ENABLED) {
      return {
        healthy: true,
        enabled: false
      };
    }

    return {
      healthy: this.isConnected,
      circuitState: this.circuitBreaker.getState(),
      producer: this.producer ? 'connected' : 'disconnected',
      consumer: this.consumer ? 'connected' : 'disconnected'
    };
  }

  /**
   * Graceful shutdown
   */
  async disconnect() {
    if (!this.config.KAFKA_ENABLED || !this.isConnected) {
      this.logger.info('Kafka already disconnected or disabled');
      return;
    }

    try {
      this.logger.info('Disconnecting Kafka...');

      if (this.producer) {
        await this.producer.disconnect();
        this.logger.info('Kafka producer disconnected');
      }

      if (this.consumer) {
        await this.consumer.disconnect();
        this.logger.info('Kafka consumer disconnected');
      }

      this.isConnected = false;

    } catch (error) {
      this.logger.error('Error disconnecting Kafka', error);
      throw error;
    }
  }
}

export const createKafkaManager = (config, logger) => {
  return new KafkaManager(config, logger);
};
