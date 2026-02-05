/**
 * IoT-Based Intelligent Health Monitoring and Alert System
 * Main Server Entry Point - Optimized for Railway Deployment
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

// Detect Railway environment
const isRailway = process.env.RAILWAY_ENVIRONMENT === 'true' || process.env.RAILWAY_STATIC_URL !== undefined;
const RAILWAY_URL = process.env.RAILWAY_STATIC_URL || process.env.RAILWAY_GIT_COMMIT_LINK || '';

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
  contentSecurityPolicy: false, // Disabled for development compatibility
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: corsOrigins,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100 // limit each IP to 100 requests per windowMs
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

// Health check endpoint - Important for Railway
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbConnected ? 'connected' : 'demo',
    environment: isRailway ? 'railway' : 'local',
    railwayUrl: RAILWAY_URL || null
  });
});

// Railway-specific readiness check
app.get('/ready', (req, res) => {
  res.status(200).json({
    ready: true,
    database: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
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
      uptime: process.uptime(),
      environment: isRailway ? 'railway' : 'local'
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

// Enhanced database connection with Railway support
const connectDB = async () => {
  try {
    // Check for Railway MongoDB first, then local, then fail gracefully
    let mongoURI = process.env.MONGODB_URI;
    
    // Railway MongoDB plugin connection
    if (process.env.MONGO_URI) {
      mongoURI = process.env.MONGO_URI;
    }
    
    // Use local fallback if no cloud URI provided
    if (!mongoURI) {
      mongoURI = 'mongodb://localhost:27017/iot_health_monitor';
    }
    
    // Mongoose connection options
    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };
    
    await mongoose.connect(mongoURI, options);
    dbConnected = true;
    logger.info('MongoDB connected successfully');
    logger.info(`Database: ${mongoose.connection.name}`);
    
    // Auto-seed if database is empty
    await autoSeedDatabase();
    
  } catch (error) {
    dbConnected = false;
    logger.warn('MongoDB connection failed - running in demo mode');
    logger.warn('To enable full features, configure MONGODB_URI or MONGO_URI in Railway variables');
    logger.warn(`Error: ${error.message}`);
  }
};

// Auto-seed database with sample data
const autoSeedDatabase = async () => {
  try {
    const Patient = require('./models/Patient');
    const count = await Patient.countDocuments();
    
    if (count === 0) {
      logger.info('Database is empty - auto-seeding with sample data...');
      
      // Import seed data
      const seedData = require('./seedData');
      
      // Insert sample patients
      if (seedData.patients && seedData.patients.length > 0) {
        await Patient.insertMany(seedData.patients);
        logger.info(`Seeded ${seedData.patients.length} sample patients`);
      }
      
      // Insert sample devices
      if (seedData.devices && seedData.devices.length > 0) {
        const Device = require('./models/Device');
        await Device.insertMany(seedData.devices);
        logger.info(`Seeded ${seedData.devices.length} sample devices`);
      }
      
      // Generate health data
      if (seedData.patients && seedData.patients.length > 0) {
        const HealthData = require('./models/HealthData');
        for (const patient of seedData.patients) {
          const device = seedData.devices?.find(d => d.patientId === patient.patientId);
          if (device) {
            const healthData = generateHealthData(patient.patientId, device.deviceId, 7);
            await HealthData.insertMany(healthData);
            logger.info(`Generated health data for ${patient.patientId}`);
          }
        }
      }
      
      logger.info('Auto-seeding completed!');
    } else {
      logger.info(`Database already has ${count} patients - skipping auto-seed`);
    }
  } catch (error) {
    logger.warn('Auto-seeding skipped:', error.message);
  }
};

// Generate sample health data
const generateHealthData = (patientId, deviceId, days = 7) => {
  const data = [];
  const now = new Date();
  
  for (let i = 0; i < days * 24; i++) {
    const timestamp = new Date(now - (days * 24 - i) * 60 * 60 * 1000);
    const isSleeping = timestamp.getHours() >= 23 || timestamp.getHours() < 6;
    const baseHeartRate = isSleeping ? 60 : 75;
    
    data.push({
      patientId,
      deviceId,
      timestamp,
      heartRate: {
        value: baseHeartRate + Math.round(Math.random() * 10 - 5),
        unit: 'bpm',
        quality: 'good'
      },
      temperature: {
        value: 36.5 + Math.round(Math.random() * 10 - 5) / 10,
        unit: '°C',
        method: 'axillary'
      },
      spo2: {
        value: 97 + Math.round(Math.random() * 4 - 2),
        unit: '%',
        quality: 'good'
      },
      bloodPressure: {
        systolic: 115 + Math.round(Math.random() * 20 - 10),
        diastolic: 75 + Math.round(Math.random() * 15 - 7),
        unit: 'mmHg'
      },
      status: 'normal'
    });
  }
  
  return data;
};

// Get port from Railway or environment
const PORT = process.env.PORT || process.env.RAILWAY_PORT || 5000;

// Start server
const startServer = async () => {
  await connectDB();
  
  server.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Environment: ${isRailway ? 'Railway' : process.env.NODE_ENV || 'development'}`);
    logger.info(`Frontend URL: ${process.env.FRONTEND_URL || 'Not configured'}`);
    
    if (isRailway) {
      logger.info(`Railway URL: https://${RAILWAY_URL}`);
    }
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

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    mongoose.connection.close(false, () => {
      logger.info('Server closed');
      process.exit(0);
    });
  });
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();

module.exports = { app, server, io };
