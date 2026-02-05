/**
 * IoT-Based Intelligent Health Monitoring and Alert System
 * Main Server Entry Point - Optimized for Railway Deployment with PostgreSQL
 */

const express = require('express');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import database
const { connectDB, getDbConnected } = require('./database');
const { seedDatabase } = require('./seed');

// Detect Railway environment
const isRailway = process.env.RAILWAY_ENVIRONMENT === 'true' || process.env.RAILWAY_STATIC_URL !== undefined;
const RAILWAY_URL = process.env.RAILWAY_STATIC_URL || process.env.RAILWAY_GIT_COMMIT_LINK || '';

// Import routes
const healthDataRoutes = require('./routes/healthData');
const alertRoutes = require('./routes/alerts');
const patientRoutes = require('./routes/patients');
const predictionRoutes = require('./routes/predictions');
const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const { logger } = require('./utils/logger');

const app = express();
const server = http.createServer(app);

// Dynamic CORS configuration for Railway
const corsOrigins = isRailway 
  ? [RAILWAY_URL, `https://${RAILWAY_URL}`, /https:\/\/.*\.railway\.app$/].filter(Boolean)
  : [process.env.FRONTEND_URL || 'http://localhost:3000', 'http://localhost:3000'];

const io = socketIo(server, {
  cors: {
    origin: corsOrigins,
    methods: ['GET', 'POST']
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: corsOrigins,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Make io accessible to routes
app.set('io', io);

// API Routes
app.use('/api/health-data', healthDataRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);

// Health check endpoint - Important for Railway
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: getDbConnected() ? 'connected' : 'disconnected',
    environment: isRailway ? 'railway' : 'local',
    railwayUrl: RAILWAY_URL || null
  });
});

// Railway-specific readiness check
app.get('/ready', (req, res) => {
  res.status(200).json({
    ready: true,
    database: getDbConnected() ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Database status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    database: {
      status: getDbConnected() ? 'connected' : 'disconnected',
      message: getDbConnected() ? 'PostgreSQL connected' : 'Database not connected'
    },
    server: {
      status: 'online',
      uptime: process.uptime(),
      environment: isRailway ? 'railway' : 'local'
    }
  });
});

// Seed endpoint (for manual seeding)
app.post('/api/seed', async (req, res) => {
  try {
    await seedDatabase();
    res.json({ success: true, message: 'Database seeded successfully' });
  } catch (error) {
    logger.error('Seed error:', error);
    res.status(500).json({ error: 'Seeding failed' });
  }
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

// Get port from Railway or environment
const PORT = process.env.PORT || process.env.RAILWAY_PORT || 5000;

// Start server
const startServer = async () => {
  // Start server first (for Railway healthcheck)
  server.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Environment: ${isRailway ? 'Railway' : process.env.NODE_ENV || 'development'}`);
    logger.info(`Frontend URL: ${process.env.FRONTEND_URL || 'Not configured'}`);
    
    if (isRailway) {
      logger.info(`Railway URL: https://${RAILWAY_URL}`);
    }
    
    // Connect to PostgreSQL database (non-blocking)
    connectDB()
      .then(connected => {
        if (connected) {
          logger.info('Database connected - seeding sample data...');
          return seedDatabase().catch(err => logger.warn('Seeding skipped:', err.message));
        } else {
          logger.warn('Database not connected - running without database');
        }
      })
      .catch(err => {
        logger.warn('Database connection error:', err.message);
      });
  });
};

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    const db = require('./database');
    if (db.pool) {
      db.pool.end(false, () => {
        logger.info('Database pool closed');
        logger.info('Server closed');
        process.exit(0);
      });
    } else {
      logger.info('Server closed');
      process.exit(0);
    }
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    const db = require('./database');
    if (db.pool) {
      db.pool.end(false, () => {
        logger.info('Database pool closed');
        logger.info('Server closed');
        process.exit(0);
      });
    } else {
      logger.info('Server closed');
      process.exit(0);
    }
  });
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();

module.exports = { app, server, io };
