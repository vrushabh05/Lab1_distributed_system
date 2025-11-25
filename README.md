# Airbnb Distributed System — Full-Stack Cloud-Native Application

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](#license)
![Node.js](https://img.shields.io/badge/Backend-Node.js%2FExpress-brightgreen)
![React](https://img.shields.io/badge/Frontend-React-blue)
![Redux](https://img.shields.io/badge/State-Redux-purple)
![Python](https://img.shields.io/badge/AI%20Agent-FastAPI-orange)
![Docker](https://img.shields.io/badge/Container-Docker-2496ED)
![Kubernetes](https://img.shields.io/badge/Orchestration-Kubernetes-326CE5)
![Kafka](https://img.shields.io/badge/Messaging-Kafka-000000)
![AWS](https://img.shields.io/badge/Cloud-AWS-FF9900)

A production-style **Airbnb distributed system** built for Lab 1 & Lab 2, showcasing:

- Full-stack web development (React + Node.js + FastAPI)
- Microservices & asynchronous communication using **Kafka**
- Cloud-native deployment with **Docker & Kubernetes**
- State management with **Redux**
- AI-powered travel planning using **LangChain FastAPI Agent**
- Performance testing & scalability analysis using **JMeter**

---

## ✨ High-Level Features

### 👤 Two Main Personas
- **Traveler**
  - Search properties
  - Make bookings
  - Manage profile & favorites
  - View past trips
- **Owner (Host)**
  - Post/manage property listings
  - Accept/Reject booking requests
  - Dashboard with booking history

### 🔁 End-to-End Booking Flow
- Booking acceptance blocks date availability  
- Cancellations free the calendar

### 📸 Rich Profile Management
- Image uploads  
- Editable personal details  
- Traveler & Host-specific information  

### 🤖 Agentic AI Concierge
Built using:
- **Python FastAPI**
- **LangChain**
- **External data via Tavily**

Outputs:
- Day-by-day itinerary  
- POIs & activities with tags  
- Restaurant suggestions (dietary-aware)  
- Weather-aware packing checklist  

🖥️ UI integrated into the dashboard as a floating button (bottom-right).

### ☁ Distributed Microservices Architecture
- Separate services for:
  - Traveler  
  - Owner  
  - Property  
  - Booking  
  - AI Concierge Service  
- **Kafka** for booking events  
- **MongoDB / MySQL** for persistence  

### 🧪 Performance Testing
Using **Apache JMeter**:
- Load tests with **100–500 concurrent users**
- Graphs for average response time, throughput, and error rate
- Performance analysis included

---

## 🧱 System Architecture

```text
 React + Redux Frontend
         │
         ▼
   REST API Gateway (Axios)
         │
         ▼
 ┌─────────────────────────────────────┐
 │ Node.js Backend Services (Express) │
 │ ├── Traveler Service               │
 │ ├── Owner Service                  │
 │ ├── Property Service               │
 │ ├── Booking Service                │  ← Kafka consumer/producer
 │ └── Session Store (MongoDB)        │
 └─────────────────────────────────────┘

 Python FastAPI AI Concierge Service (LangChain)
         │
         ▼
      Kafka Broker (booking events)

 Dockerized → Deployed to Kubernetes → Hosted on AWS

🏗 Tech Stack Overview
🌐 Frontend (React + Redux)

React (Vite/CRA)

Redux Toolkit

React Router

Axios

Bootstrap / Tailwind CSS

🖥 Backend (Node.js + Express)

REST APIs for:

Authentication

Property Search

Bookings

Dashboards

MySQL / MongoDB

bcrypt for password hashing

express-session or JWT

🤖 AI Agent Service (FastAPI)

Python 3.x

LangChain

External web search (Tavily)

Generates multi-day travel plans

🐳 DevOps & Cloud

Docker (Service-level containers)

Kubernetes (Deployments, Services, Ingress)

Kafka + Zookeeper

AWS EC2/EKS

JMeter (Performance Testing)
