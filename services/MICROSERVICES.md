# Voyage Microservices Architecture

**Version:** 2.0.0  
**Architecture:** Event-Driven Microservices with MongoDB + Kafka  
**Stack:** Node.js 18+ | Express | MongoDB | Kafka | Kubernetes-ready

---

## Architecture Overview

Voyage uses a microservices architecture with event-driven communication:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│  API Gateway │────▶│ Microservices│
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                                                  ▼
                                          ┌──────────────┐
                                          │    Kafka     │◀──── Event Bus
                                          └──────────────┘
                                                  │
                        ┌─────────────────────────┼─────────────────────────┐
                        ▼                         ▼                         ▼
                ┌───────────────┐         ┌───────────────┐       ┌───────────────┐
                │   Traveler    │         │     Owner     │       │    Booking    │
                │   Service     │         │   Service     │       │   Service     │
                │  (Port 3001)  │         │  (Port 3002)  │       │  (Port 3004)  │
                └───────┬───────┘         └───────┬───────┘       └───────┬───────┘
                        │                         │                       │
                        └─────────────────────────┴───────────────────────┘
                                                  ▼
                                          ┌──────────────┐
                                          │   MongoDB    │
                                          └──────────────┘
```

### Services

| Service | Port | Database | Kafka | Purpose |
|---------|------|----------|-------|---------|
| **Traveler Service** | 3001 | MongoDB | Consumer | User authentication, favorites, bookings |
| **Owner Service** | 3002 | MongoDB | Producer | Property management, booking approvals |
| **Property Service** | 3003 | MongoDB | - | Property CRUD, search |
| **Booking Service** | 3004 | MongoDB | Consumer | Booking status synchronization |
| **Agent Service** | 8000 | MySQL | - | AI travel itinerary generation |

---

## Shared Core Infrastructure

All microservices use a common core module (`@voyage/shared-core`) for:

### 1. Configuration Management

```javascript
import { config } from '@voyage/shared-core';

config.PORT              // Application port
config.MONGODB_URI       // Database connection string
config.KAFKA_ENABLED     // Enable/disable Kafka
config.KAFKA_BROKER      // Kafka broker address
config.LOG_LEVEL         // Logging verbosity (debug/info/warn/error)
config.SHUTDOWN_TIMEOUT  // Graceful shutdown timeout (30s default)
```

**Environment Variables:**
```bash
# Application
SERVICE_NAME=traveler-service
PORT=3001
NODE_ENV=production

# MongoDB
MONGODB_URI=mongodb://mongodb:27017/airbnb
MONGODB_POOL_SIZE=10

# Kafka
KAFKA_ENABLED=true
KAFKA_BROKER=kafka:9092
KAFKA_CLIENT_ID=traveler-service
KAFKA_GROUP_ID=traveler-group

# Logging
LOG_LEVEL=info

# CORS
CORS_ORIGIN=http://localhost:5173
```

### 2. Structured Logging

```javascript
import { createLogger } from '@voyage/shared-core';

const logger = createLogger('service-name', 'info');

// Correlation ID support
const childLogger = logger.child(correlationId);
childLogger.info('User logged in', { userId: 123 });

// Error logging with stack traces
logger.error('Database query failed', error, { query: 'SELECT ...' });
```

**Log Format:**
```
[2025-01-15 10:30:45] INFO [traveler-service] [correlation-id-uuid]: User logged in {"userId":123,"duration":"45ms"}
```

### 3. Database Management

```javascript
import { createDatabaseManager } from '@voyage/shared-core';

const db = createDatabaseManager(config, logger);

// Connect with retry logic (3 attempts, exponential backoff)
await db.connect();

// Health check
const health = await db.healthCheck();
// { healthy: true, latency: "5ms", connections: { total: 10, available: 8 } }

// Graceful shutdown
await db.disconnect();
```

**Features:**
- Connection pooling (10 connections default)
- Automatic reconnection on disconnect
- Health monitoring with latency tracking
- Graceful shutdown

### 4. Kafka Management with Circuit Breaker

```javascript
import { createKafkaManager } from '@voyage/shared-core';

const kafka = createKafkaManager(config, logger);

// Initialize client
kafka.initialize();

// Create producer
await kafka.createProducer();

// Send message (with circuit breaker)
await kafka.sendMessage('booking-updates', {
  bookingId: '123',
  status: 'confirmed'
}, 'booking-123');

// Create consumer
const consumer = await kafka.createConsumer('my-group');
await kafka.subscribe('topic-name', async (data) => {
  console.log('Received:', data);
});

// Graceful shutdown
await kafka.disconnect();
```

**Circuit Breaker:**
- **CLOSED**: Normal operation
- **OPEN**: Too many failures (5 threshold), reject requests for 60s
- **HALF_OPEN**: Testing recovery (2 successful requests to close)

### 5. Health Checks

```javascript
import { createHealthChecker } from '@voyage/shared-core';

const health = createHealthChecker('service-name', logger);

// Register custom health checks
health.registerCheck('database', () => db.healthCheck());
health.registerCheck('kafka', () => kafka.healthCheck());

// Liveness probe (fast, always returns 200)
const liveness = await health.liveness();
// { alive: true, service: "service-name", uptime: 3600 }

// Readiness probe (checks dependencies)
const readiness = await health.readiness();
// { ready: true, checks: { database: {...}, kafka: {...} } }

// Detailed health (includes metrics)
const detailed = await health.detailed();
// { ...readiness, metrics: { memory: {...}, cpu: {...} } }
```

### 6. Error Classes

```javascript
import {
  NotFoundError,
  ValidationError,
  AuthenticationError,
  DatabaseError
} from '@voyage/shared-core';

// Throw with context
throw new NotFoundError('Booking', bookingId);
// → 404: "Booking not found: 123"

throw new ValidationError('Invalid email format', { email });
// → 400: "Invalid email format"

// Automatic JSON serialization
res.status(err.statusCode).json(err.toJSON());
// { error: { name, message, code, statusCode, details, timestamp } }
```

---

## Service Patterns

### Standard Service Structure

```javascript
// ============================================================================
// INITIALIZATION
// ============================================================================

const SERVICE_NAME = 'my-service';
config.SERVICE_NAME = SERVICE_NAME;

const logger = createLogger(SERVICE_NAME, config.LOG_LEVEL);
const db = createDatabaseManager(config, logger);
const kafka = createKafkaManager(config, logger);
const health = createHealthChecker(SERVICE_NAME, logger);

const app = express();

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Security
app.use(helmet());
app.use(compression());
app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }));
app.use(express.json());

// Request logging with correlation ID
app.use((req, res, next) => {
  req.correlationId = logger.generateCorrelationId();
  req.logger = logger.child(req.correlationId);
  
  const startTime = Date.now();
  res.on('finish', () => {
    req.logger.info(`${req.method} ${req.path}`, {
      statusCode: res.statusCode,
      duration: `${Date.now() - startTime}ms`
    });
  });
  
  next();
});

// ============================================================================
// ROUTES
// ============================================================================

app.get('/healthz', async (req, res) => {
  res.json(await health.liveness());
});

app.get('/health', async (req, res) => {
  const result = await health.readiness();
  res.status(result.ready ? 200 : 503).json(result);
});

// Business routes...

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((err, req, res, next) => {
  if (err instanceof ApplicationError) {
    req.logger.warn('Application error', { code: err.code });
    return res.status(err.statusCode).json(err.toJSON());
  }
  
  req.logger.error('Unhandled error', err);
  res.status(500).json({
    error: { message: config.isDevelopment() ? err.message : 'Internal server error' }
  });
});

// ============================================================================
// STARTUP & SHUTDOWN
// ============================================================================

async function startup() {
  await db.connect();
  kafka.initialize();
  
  health.registerCheck('database', () => db.healthCheck());
  health.registerCheck('kafka', () => kafka.healthCheck());
  
  server = app.listen(config.PORT, () => {
    logger.info(`${SERVICE_NAME} listening on port ${config.PORT}`);
  });
}

async function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down...`);
  
  if (server) await new Promise(resolve => server.close(resolve));
  await kafka.disconnect();
  await db.disconnect();
  
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startup();
```

---

## Event-Driven Communication

### Kafka Topics

| Topic | Producer | Consumer(s) | Payload | Purpose |
|-------|----------|-------------|---------|---------|
| `booking-requests` | Traveler Service | Owner Service | `{ bookingId, propertyId, travelerId, dates, guests }` | New booking requests |
| `booking-updates` | Owner Service | Booking Service, Traveler Service | `{ bookingId, status, updatedBy }` | Booking status changes (approved/rejected) |
| `property-updates` | Property Service | Search Service | `{ propertyId, action, data }` | Property CRUD events |

### Event Flow Example: Booking Approval

```
1. Traveler creates booking
   ├─▶ Traveler Service saves to MongoDB
   └─▶ Kafka Producer: booking-requests topic
         { bookingId: "123", propertyId: "456", status: "pending" }

2. Owner reviews booking
   ├─▶ Owner Service fetches from MongoDB
   └─▶ Owner approves → updates MongoDB
         └─▶ Kafka Producer: booking-updates topic
               { bookingId: "123", status: "confirmed" }

3. Booking Service receives event
   ├─▶ Kafka Consumer: booking-updates topic
   └─▶ Updates booking status in MongoDB
         └─▶ Logs: "Booking 123 updated to confirmed"

4. Traveler Service receives event
   ├─▶ Kafka Consumer: booking-updates topic
   └─▶ Notifies traveler (WebSocket/Email)
```

### Producing Events

```javascript
// Owner Service - Approve booking
router.post('/bookings/:id/approve', async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  booking.status = 'confirmed';
  await booking.save();
  
  // Publish event to Kafka
  await kafka.sendMessage('booking-updates', {
    bookingId: booking._id,
    status: 'confirmed',
    updatedBy: req.user.id,
    timestamp: new Date().toISOString()
  }, booking._id);
  
  req.logger.info('Booking approved', { bookingId: booking._id });
  res.json({ success: true, booking });
});
```

### Consuming Events

```javascript
// Booking Service - Subscribe to updates
async function setupKafkaConsumer() {
  const consumer = await kafka.createConsumer('booking-status-sync-group');
  if (!consumer) return;
  
  await kafka.subscribe('booking-updates', async (updateData) => {
    logger.info('Received booking update', {
      bookingId: updateData.bookingId,
      status: updateData.status
    });
    
    const booking = await Booking.findById(updateData.bookingId);
    if (booking) {
      booking.status = updateData.status;
      await booking.save();
      logger.info('Booking synchronized', { bookingId: booking._id });
    }
  });
}
```

---

## Deployment

### Docker Compose

```yaml
version: '3.8'

services:
  traveler-service:
    build: ./services/traveler-service
    ports:
      - "3001:3001"
    environment:
      - SERVICE_NAME=traveler-service
      - MONGODB_URI=mongodb://mongodb:27017/airbnb
      - KAFKA_BROKER=kafka:9092
      - LOG_LEVEL=info
    depends_on:
      - mongodb
      - kafka
    restart: unless-stopped

  owner-service:
    build: ./services/owner-service
    ports:
      - "3002:3002"
    environment:
      - SERVICE_NAME=owner-service
      - MONGODB_URI=mongodb://mongodb:27017/airbnb
      - KAFKA_BROKER=kafka:9092
      - LOG_LEVEL=info
    depends_on:
      - mongodb
      - kafka

  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db

  kafka:
    image: bitnami/kafka:3.6
    ports:
      - "9092:9092"
    environment:
      - KAFKA_CFG_NODE_ID=0
      - KAFKA_CFG_PROCESS_ROLES=controller,broker
      - KAFKA_CFG_LISTENERS=PLAINTEXT://:9092,CONTROLLER://:9093
      - KAFKA_CFG_ADVERTISED_LISTENERS=PLAINTEXT://kafka:9092
      - KAFKA_CFG_CONTROLLER_LISTENER_NAMES=CONTROLLER
      - KAFKA_CFG_CONTROLLER_QUORUM_VOTERS=0@kafka:9093

volumes:
  mongodb_data:
```

### Kubernetes

```yaml
# traveler-service.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: traveler-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: traveler-service
  template:
    metadata:
      labels:
        app: traveler-service
    spec:
      containers:
      - name: traveler-service
        image: voyage/traveler-service:latest
        ports:
        - containerPort: 3001
        env:
        - name: SERVICE_NAME
          value: "traveler-service"
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: mongodb-secret
              key: uri
        - name: KAFKA_BROKER
          value: "kafka-service:9092"
        - name: LOG_LEVEL
          value: "info"
        
        livenessProbe:
          httpGet:
            path: /healthz
            port: 3001
          initialDelaySeconds: 10
          periodSeconds: 30
        
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 10
        
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"

---
apiVersion: v1
kind: Service
metadata:
  name: traveler-service
spec:
  selector:
    app: traveler-service
  ports:
  - protocol: TCP
    port: 3001
    targetPort: 3001
  type: ClusterIP
```

---

## Monitoring & Observability

### Metrics to Track

1. **Request Metrics**
   - Request rate (req/sec)
   - Response time (p50, p95, p99)
   - Error rate (4xx, 5xx)

2. **Database Metrics**
   - Connection pool utilization
   - Query latency
   - Connection errors

3. **Kafka Metrics**
   - Message throughput (msg/sec)
   - Consumer lag
   - Circuit breaker state
   - Rebalance events

4. **Resource Metrics**
   - CPU usage
   - Memory usage (heap/RSS)
   - Network I/O

### Logging Best Practices

```javascript
// ✅ Good: Structured logging with context
logger.info('Booking created', {
  bookingId: booking._id,
  propertyId: booking.propertyId,
  travelerId: req.user.id,
  amount: booking.totalPrice,
  correlationId: req.correlationId
});

// ❌ Bad: Unstructured console.log
console.log('Created booking: ' + booking._id);
```

### Distributed Tracing

Correlation IDs propagate across services:

```
[Request ID: abc-123]
├─▶ Traveler Service: POST /api/bookings
│   └─▶ MongoDB: INSERT booking
│       └─▶ Kafka Producer: booking-requests
│
└─▶ Owner Service: Kafka Consumer
    └─▶ MongoDB: SELECT booking
        └─▶ Kafka Producer: booking-updates
            └─▶ Booking Service: Kafka Consumer
                └─▶ MongoDB: UPDATE booking
```

Each log entry includes the correlation ID for request tracing.

---

## Troubleshooting

### Common Issues

**"MongoDB connection refused"**
```bash
# Check connectivity
nc -zv mongodb 27017

# Check credentials
kubectl get secret mongodb-secret -o yaml

# Inspect logs
kubectl logs -f deployment/traveler-service
```

**"Kafka consumer lag increasing"**
```bash
# Check consumer group status
kafka-consumer-groups.sh --bootstrap-server kafka:9092 --group booking-status-sync-group --describe

# Increase consumer instances
kubectl scale deployment/booking-service --replicas=5
```

**"Circuit breaker OPEN"**
```bash
# Check Kafka broker health
kubectl exec -it kafka-0 -- kafka-broker-api-versions.sh --bootstrap-server localhost:9092

# Force circuit reset (restart service)
kubectl rollout restart deployment/owner-service
```

**"Health check failing"**
```bash
# Test health endpoints
curl http://localhost:3001/health
curl http://localhost:3001/healthz

# Check MongoDB connection
kubectl exec -it mongodb-0 -- mongo --eval "db.adminCommand('ping')"
```

---

## Performance Characteristics

### Benchmarks

| Metric | Target | Actual | Notes |
|--------|--------|--------|-------|
| Request latency (p95) | <100ms | ~75ms | Database queries optimized |
| Throughput | 1000 req/sec | 1200 req/sec | With 3 replicas |
| Kafka lag | <1s | ~200ms | Normal operation |
| Memory per service | <512MB | ~300MB | Stable under load |
| CPU per service | <50% | ~25% | Steady state |

### Scalability

- **Horizontal scaling**: Add replicas (`kubectl scale`)
- **Database**: MongoDB replica set (3 nodes)
- **Kafka**: Partitioned topics (3 partitions)
- **Connection pooling**: 10 connections per service

---

## Future Enhancements

1. **API Gateway**: Kong or NGINX for routing, rate limiting, authentication
2. **Service Mesh**: Istio for traffic management, security, observability
3. **Event Sourcing**: Store all events for audit trail and replay
4. **CQRS**: Separate read/write models for search optimization
5. **Saga Pattern**: Distributed transactions with compensation logic
6. **Observability**: OpenTelemetry for distributed tracing
7. **Chaos Engineering**: Inject failures to test resilience

---

**Last Updated:** 2025-01-15  
**Maintainer:** Engineering Team  
**License:** Proprietary
