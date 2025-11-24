#!/bin/bash

echo "🚀 Deploying Airbnb Lab2 to Kubernetes..."

# Apply configurations
echo "📋 Creating ConfigMap and Secrets..."
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml

# Deploy infrastructure
echo "🗄️  Deploying MongoDB..."
kubectl apply -f k8s/mongodb.yaml

echo "📨 Deploying Kafka & Zookeeper..."
kubectl apply -f k8s/kafka.yaml

echo "🧠 Deploying Ollama (LLM runtime)..."
kubectl apply -f k8s/ollama.yaml

# Wait for infrastructure
echo "⏳ Waiting for infrastructure to be ready..."
kubectl wait --for=condition=ready pod -l app=mongodb --timeout=120s
kubectl wait --for=condition=ready pod -l app=zookeeper --timeout=120s
kubectl wait --for=condition=ready pod -l app=kafka --timeout=120s
kubectl wait --for=condition=ready pod -l app=ollama --timeout=180s

# Deploy services
echo "🔧 Deploying Microservices..."
kubectl apply -f k8s/traveler-service.yaml
kubectl apply -f k8s/owner-service.yaml
kubectl apply -f k8s/services.yaml
kubectl apply -f k8s/frontend-agent.yaml

# Wait for services
echo "⏳ Waiting for services to be ready..."
kubectl wait --for=condition=ready pod -l app=traveler-service --timeout=120s
kubectl wait --for=condition=ready pod -l app=owner-service --timeout=120s
kubectl wait --for=condition=ready pod -l app=property-service --timeout=120s
kubectl wait --for=condition=ready pod -l app=booking-service --timeout=120s
kubectl wait --for=condition=ready pod -l app=frontend --timeout=120s

echo "✅ Deployment complete!"
echo ""
echo "📊 Service Status:"
kubectl get pods
echo ""
kubectl get services
echo ""
echo "🌐 Access the application:"
echo "Frontend: http://localhost (via LoadBalancer)"
echo "Traveler API: http://localhost:3001"
