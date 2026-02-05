/**
 * PostgreSQL Database Connection
 * Optimized for Neon PostgreSQL with Railway deployment
 */

const { Pool } = require('pg');
require('dotenv').config();

// Detect environment
const isRailway = process.env.RAILWAY_ENVIRONMENT === 'true' || process.env.RAILWAY_STATIC_URL !== undefined;

// Database configuration
const poolConfig = {
  connectionString: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL,
  ssl: isRailway ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Create connection pool
const pool = new Pool(poolConfig);

// Track connection status
let dbConnected = false;

// Log connection events
pool.on('connect', () => {
  logger.info('New PostgreSQL client connected');
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL client error:', err);
});

// Connect to database
const connectDB = async () => {
  try {
    const client = await pool.connect();
    
    // Test connection
    const result = await client.query('SELECT NOW()');
    logger.info('PostgreSQL connected successfully');
    logger.info(`Server time: ${result.rows[0].now}`);
    
    client.release();
    dbConnected = true;
    
    // Run migrations
    await runMigrations();
    
    return true;
  } catch (error) {
    logger.error('PostgreSQL connection failed:', error.message);
    dbConnected = false;
    return false;
  }
};

// Run database migrations
const runMigrations = async () => {
  try {
    const client = await pool.connect();
    
    // Create tables if they don't exist
    await client.query(`
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        role VARCHAR(50) DEFAULT 'viewer',
        status VARCHAR(50) DEFAULT 'pending',
        is_demo BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Patients table
      CREATE TABLE IF NOT EXISTS patients (
        id SERIAL PRIMARY KEY,
        patient_id VARCHAR(50) UNIQUE NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        date_of_birth DATE,
        gender VARCHAR(20),
        status VARCHAR(50) DEFAULT 'active',
        address TEXT,
        emergency_contact VARCHAR(255),
        medical_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Devices table
      CREATE TABLE IF NOT EXISTS devices (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(50) UNIQUE NOT NULL,
        patient_id VARCHAR(50),
        type VARCHAR(50) DEFAULT 'ESP32',
        status VARCHAR(50) DEFAULT 'offline',
        firmware VARCHAR(50),
        battery_level INTEGER,
        last_seen TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE SET NULL
      );

      -- Health data table
      CREATE TABLE IF NOT EXISTS health_data (
        id SERIAL PRIMARY KEY,
        patient_id VARCHAR(50) NOT NULL,
        device_id VARCHAR(50),
        heart_rate INTEGER,
        heart_rate_unit VARCHAR(10) DEFAULT 'bpm',
        temperature DECIMAL(4,1),
        temperature_unit VARCHAR(10) DEFAULT '°C',
        spo2 INTEGER,
        spo2_unit VARCHAR(10) DEFAULT '%',
        blood_pressure_systolic INTEGER,
        blood_pressure_diastolic INTEGER,
        blood_pressure_unit VARCHAR(10) DEFAULT 'mmHg',
        status VARCHAR(50) DEFAULT 'normal',
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
        FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE SET NULL
      );

      -- Alerts table
      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        alert_id VARCHAR(50) UNIQUE NOT NULL,
        patient_id VARCHAR(50) NOT NULL,
        device_id VARCHAR(50),
        type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT,
        status VARCHAR(50) DEFAULT 'active',
        acknowledged_by VARCHAR(255),
        acknowledged_at TIMESTAMP,
        resolved_by VARCHAR(255),
        resolved_at TIMESTAMP,
        resolution_method VARCHAR(100),
        resolution_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
        FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE SET NULL
      );

      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_patients_patient_id ON patients(patient_id);
      CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);
      CREATE INDEX IF NOT EXISTS idx_health_data_patient_id ON health_data(patient_id);
      CREATE INDEX IF NOT EXISTS idx_health_data_timestamp ON health_data(timestamp);
      CREATE INDEX IF NOT EXISTS idx_alerts_patient_id ON alerts(patient_id);
      CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);
    
    client.release();
    logger.info('Database migrations completed successfully');
    
    return true;
  } catch (error) {
    logger.error('Migration error:', error.message);
    return false;
  }
};

// Query helper
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text: text.substring(0, 100), duration, rows: result.rowCount });
    return result;
  } catch (error) {
    logger.error('Query error:', { text: text.substring(0, 100), error: error.message });
    throw error;
  }
};

// Get client for transactions
const getClient = () => pool.connect();

// Export
const logger = require('./utils/logger');
module.exports = {
  pool,
  query,
  getClient,
  connectDB,
  runMigrations,
  getDbConnected: () => dbConnected
};
