/**
 * Authentication Routes
 * Login, signup, and token management - PostgreSQL version
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { query } = require('../database');
const { logger } = require('../utils/logger');

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

// Helper to get user by email
const getUserByEmail = async (email) => {
  const result = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  return result.rows[0] || null;
};

// Helper to create user
const createUser = async (userData) => {
  const { email, password, firstName, lastName, role, status, isDemo } = userData;
  const result = await query(`
    INSERT INTO users (email, password, first_name, last_name, role, status, is_demo)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, email, first_name, last_name, role, status, is_demo, created_at
  `, [email.toLowerCase(), password, firstName, lastName, role || 'viewer', status || 'active', isDemo || false]);
  return result.rows[0];
};

// Demo user credentials
const DEMO_EMAIL = 'demo@healthmonitor.com';
const DEMO_PASSWORD = 'demo1234';

// POST /api/auth/login - User login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Demo user special handling - always allow demo login
    if (email.toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD) {
      // Find or create demo user
      let user = await getUserByEmail(DEMO_EMAIL);
      
      if (!user) {
        // Create demo user with plain password (will be hashed)
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, salt);
        
        user = await createUser({
          email: DEMO_EMAIL,
          password: hashedPassword,
          firstName: 'Demo',
          lastName: 'Admin',
          role: 'admin',
          status: 'active',
          isDemo: true
        });
        logger.info('Demo user created');
      }

      const token = generateToken(user);
      
      return res.json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          isDemo: user.is_demo
        }
      });
    }

    // Regular user login
    // Find user in database
    const user = await getUserByEmail(email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(401).json({ error: 'Account is not active' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate token
    const token = generateToken(user);

    logger.info(`User logged in: ${user.email}`);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        isDemo: user.is_demo
      }
    });

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/signup - User registration
router.post('/signup', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Validate input
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check password length
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const user = await createUser({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: 'viewer',
      status: 'active',
      isDemo: false
    });

    // Generate token
    const token = generateToken(user);

    logger.info(`New user registered: ${user.email}`);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      }
    });

  } catch (error) {
    logger.error('Signup error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// GET /api/auth/me - Get current user
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await query('SELECT id, email, first_name, last_name, role, status, is_demo, created_at FROM users WHERE id = $1', [decoded.id]);

    if (!user.rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: user.rows[0] });

  } catch (error) {
    logger.error('Auth check error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// POST /api/auth/logout - Logout (client-side token removal)
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;
