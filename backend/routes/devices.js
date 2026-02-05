/**
 * Devices Routes
 * API endpoints for device management - PostgreSQL version
 */

const express = require('express');
const router = express.Router();
const { query } = require('../database');
const { logger } = require('../utils/logger');

// Helper to format device from DB row
const formatDevice = (row) => ({
  id: row.id,
  deviceId: row.device_id,
  patientId: row.patient_id,
  type: row.type,
  status: row.status,
  firmware: row.firmware,
  batteryLevel: row.battery_level,
  lastSeen: row.last_seen,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

// GET /api/devices - Get all devices
router.get('/', async (req, res) => {
  try {
    const { status, patientId, limit = 100, skip = 0 } = req.query;
    
    let sql = 'SELECT * FROM devices WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (status) {
      sql += ` AND status = $${paramIndex++}`;
      params.push(status);
    }
    
    if (patientId) {
      sql += ` AND patient_id = $${paramIndex++}`;
      params.push(patientId);
    }
    
    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(parseInt(limit), parseInt(skip));
    
    const result = await query(sql, params);
    
    // Get total count
    let countSql = 'SELECT COUNT(*) FROM devices WHERE 1=1';
    const countParams = [];
    
    if (status) {
      countSql += ' AND status = $1';
      countParams.push(status);
    }
    
    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      devices: result.rows.map(formatDevice),
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip)
      }
    });

  } catch (error) {
    logger.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// GET /api/devices/stats - Get device statistics
router.get('/stats', async (req, res) => {
  try {
    const result = await query(`
      SELECT status, COUNT(*) as count 
      FROM devices 
      GROUP BY status
    `);

    res.json({
      statusCounts: result.rows.map(r => ({ _id: r.status, count: parseInt(r.count) })),
      total: result.rows.reduce((acc, r) => acc + parseInt(r.count), 0)
    });

  } catch (error) {
    logger.error('Error fetching device stats:', error);
    res.status(500).json({ error: 'Failed to fetch device statistics' });
  }
});

// GET /api/devices/:deviceId - Get single device
router.get('/:deviceId', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM devices WHERE device_id = $1',
      [req.params.deviceId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json(formatDevice(result.rows[0]));

  } catch (error) {
    logger.error('Error fetching device:', error);
    res.status(500).json({ error: 'Failed to fetch device' });
  }
});

// POST /api/devices - Create new device
router.post('/', async (req, res) => {
  try {
    const deviceData = req.body;
    
    // Generate device ID if not provided
    const deviceId = deviceData.deviceId || `DEV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const result = await query(`
      INSERT INTO devices (device_id, patient_id, type, status, firmware)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      deviceId,
      deviceData.patientId,
      deviceData.type || 'ESP32',
      deviceData.status || 'offline',
      deviceData.firmware
    ]);

    logger.info(`New device created: ${deviceId}`);

    res.status(201).json(formatDevice(result.rows[0]));

  } catch (error) {
    logger.error('Error creating device:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Device ID already exists' });
    }
    res.status(500).json({ error: 'Failed to create device' });
  }
});

// PUT /api/devices/:deviceId - Update device
router.put('/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const updates = req.body;

    const result = await query(`
      UPDATE devices 
      SET patient_id = COALESCE($1, patient_id),
          type = COALESCE($2, type),
          status = COALESCE($3, status),
          firmware = COALESCE($4, firmware),
          battery_level = COALESCE($5, battery_level),
          last_seen = COALESCE($6, last_seen),
          updated_at = CURRENT_TIMESTAMP
      WHERE device_id = $7
      RETURNING *
    `, [
      updates.patientId,
      updates.type,
      updates.status,
      updates.firmware,
      updates.batteryLevel,
      updates.lastSeen,
      deviceId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json({
      success: true,
      device: formatDevice(result.rows[0])
    });

  } catch (error) {
    logger.error('Error updating device:', error);
    res.status(500).json({ error: 'Failed to update device' });
  }
});

// PUT /api/devices/:deviceId/status - Update device status
router.put('/:deviceId/status', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { status } = req.body;

    const validStatuses = ['online', 'offline', 'maintenance', 'error'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await query(`
      UPDATE devices 
      SET status = $1, last_seen = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE device_id = $2
      RETURNING *
    `, [status, deviceId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Emit real-time status update
    const io = req.app.get('io');
    io.to(`device-${deviceId}`).emit('deviceStatus', {
      deviceId,
      status
    });

    res.json({
      success: true,
      device: formatDevice(result.rows[0])
    });

  } catch (error) {
    logger.error('Error updating device status:', error);
    res.status(500).json({ error: 'Failed to update device status' });
  }
});

// DELETE /api/devices/:deviceId - Delete device
router.delete('/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;

    const result = await query(`
      DELETE FROM devices WHERE device_id = $1 RETURNING device_id
    `, [deviceId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json({
      success: true,
      message: 'Device deleted'
    });

  } catch (error) {
    logger.error('Error deleting device:', error);
    res.status(500).json({ error: 'Failed to delete device' });
  }
});

module.exports = router;
