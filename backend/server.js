/**
 * IoT-Based Intelligent Health Monitoring and Alert System
 * Main Server Entry Point
 */

const express = require('express');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// MongoDB connection status
let dbConnected = false;

// Import routes
const healthDataRoutes = require('./routes/healthData');
const alertRoutes = require('./routes/alerts');
const patientRoutes = require('./routes/patients');
const predictionRoutes = require('./routes/predictions');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const { logger } = require('./utils/logger');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Make io accessible to routes
app.set('io', io);

// API Routes
app.use('/api/health-data', healthDataRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/predictions', predictionRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbConnected ? 'connected' : 'demo'
  });
});

// Database status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    database: {
      status: dbConnected ? 'connected' : 'demo',
      message: dbConnected ? 'MongoDB connected' : 'Running in demo mode'
    },
    server: {
      status: 'online',
      uptime: process.uptime()
    }
  });
});

// Serve frontend for all non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Route not found' });
  }
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Socket.IO connection handling for real-time data
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('subscribe-patient', (patientId) => {
    socket.join(`patient-${patientId}`);
    logger.info(`Client ${socket.id} subscribed to patient ${patientId}`);
  });

  socket.on('unsubscribe-patient', (patientId) => {
    socket.leave(`patient-${patientId}`);
    logger.info(`Client ${socket.id} unsubscribed from patient ${patientId}`);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/iot_health_monitor';
    await mongoose.connect(mongoURI);
    dbConnected = true;
    logger.info('MongoDB connected successfully');
  } catch (error) {
    dbConnected = false;
    logger.warn('MongoDB connection failed - running in demo mode');
    logger.warn('To enable full features, configure MONGODB_URI in .env file');
  }
};

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  
  server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
};

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    mongoose.connection.close(false, () => {
      logger.info('Server closed');
      process.exit(0);
    });
  });
});

startServer();

module.exports = { app, server, io };
