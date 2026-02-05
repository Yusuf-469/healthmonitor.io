/**
 * PostgreSQL Database Connection
 * Optimized for Railway PostgreSQL with auto-reconnect
 */

const { Pool } = require('pg');
require('dotenv').config();

// Detect environment
const isRailway = process.env.RAILWAY_ENVIRONMENT === 'true' || process.env.RAILWAY_STATIC_URL !== undefined;

// Database configuration
const getConnectionString = () => {
  // Try Railway DATABASE_URL first
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  // Fallback to NEON_DATABASE_URL
  if (process.env.NEON_DATABASE_URL) {
    return process.env.NEON_DATABASE_URL;
  }
  return null;
};

const connectionString = getConnectionString();

// Normalize connection string (accept both postgres:// and postgresql://)
const normalizeConnectionString = (str) => {
  if (!str) return null;
  if (str.startsWith('postgresql://')) {
    return 'postgres://' + str.substring(12);
  }
  return str;
};

const normalizedConnectionString = normalizeConnectionString(connectionString);

// Pool configuration - use minimal settings for Railway
const poolConfig = normalizedConnectionString ? {
  connectionString: normalizedConnectionString,
  ssl: isRailway ? { rejectUnauthorized: false } : false,
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
  keepAlive: true,
} : null;

console.log('Database config:', connectionString ? 'Connection string present' : 'No connection string');

let pool = null;
let dbConnected = false;
let connectPromise = null;

// Only create pool if we have a connection string
if (poolConfig) {
  pool = new Pool(poolConfig);
  
  pool.on('error', (err) => {
    console.error('Unexpected database pool error:', err.message);
  });
}

// Connect to database with retry logic
const connectDB = async (retryCount = 0, maxRetries = 3) => {
  if (!connectionString) {
    console.log('No DATABASE_URL configured - running without database');
    return false;
  }
  
  // Return existing connection promise if already connecting
  if (connectPromise) {
    return connectPromise;
  }
  
  connectPromise = (async () => {
    try {
      console.log('Attempting database connection...');
      const client = await pool.connect();
      
      // Test connection
      const result = await client.query('SELECT NOW()');
      console.log('Database connected successfully at:', result.rows[0].now);
      
      client.release();
      dbConnected = true;
      
      // Run migrations
      await runMigrations();
      
      console.log('Database ready!');
      return true;
    } catch (error) {
      console.error('Database connection failed:', error.message);
      dbConnected = false;
      
      // Retry logic
      if (retryCount < maxRetries) {
        console.log(`Retrying database connection (${retryCount + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return connectDB(retryCount + 1, maxRetries);
      }
      
      console.warn('Database connection failed - continuing without database');
      return false;
    }
  })();
  
  return connectPromise;
};

// Run database migrations
const runMigrations = async () => {
  if (!pool) return false;
  
  try {
    const client = await pool.connect();
    
    // Create tables
    await client.query(`
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS devices (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(50) UNIQUE NOT NULL,
        patient_id VARCHAR(50),
        type VARCHAR(50) DEFAULT 'ESP32',
        status VARCHAR(50) DEFAULT 'offline',
        firmware VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS health_data (
        id SERIAL PRIMARY KEY,
        patient_id VARCHAR(50) NOT NULL,
        device_id VARCHAR(50),
        heart_rate INTEGER,
        temperature DECIMAL(4,1),
        spo2 INTEGER,
        blood_pressure_systolic INTEGER,
        blood_pressure_diastolic INTEGER,
        status VARCHAR(50) DEFAULT 'normal',
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    client.release();
    console.log('Database migrations completed');
    return true;
  } catch (error) {
    console.error('Migration error:', error.message);
    return false;
  }
};

// Query helper
const query = async (text, params) => {
  if (!pool || !dbConnected) {
    throw new Error('Database not connected');
  }
  
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  
  if (duration > 100) {
    console.log('Slow query:', text.substring(0, 50), duration + 'ms');
  }
  
  return result;
};

// Get client
const getClient = () => pool ? pool.connect() : null;

module.exports = {
  pool,
  query,
  getClient,
  connectDB,
  runMigrations,
  getDbConnected: () => dbConnected
};
