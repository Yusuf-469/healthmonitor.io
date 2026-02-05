/**
 * Alerts Routes
 * API endpoints for alerts management - PostgreSQL version
 */

const express = require('express');
const router = express.Router();
const { query } = require('../database');
const { logger } = require('../utils/logger');

// Helper to format alert from DB row
const formatAlert = (row) => ({
  id: row.id,
  alertId: row.alert_id,
  patientId: row.patient_id,
  deviceId: row.device_id,
  type: row.type,
  severity: row.severity,
  title: row.title,
  message: row.message,
  status: row.status,
  acknowledgedBy: row.acknowledged_by,
  acknowledgedAt: row.acknowledged_at,
  resolvedBy: row.resolved_by,
  resolvedAt: row.resolved_at,
  resolutionMethod: row.resolution_method,
  resolutionNotes: row.resolution_notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

// GET /api/alerts - Get all alerts
router.get('/', async (req, res) => {
  try {
    const { status, severity, patientId, limit = 100, skip = 0 } = req.query;
    
    let sql = 'SELECT * FROM alerts WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (status) {
      sql += ` AND status = $${paramIndex++}`;
      params.push(status);
    }
    
    if (severity) {
      sql += ` AND severity = $${paramIndex++}`;
      params.push(severity);
    }
    
    if (patientId) {
      sql += ` AND patient_id = $${paramIndex++}`;
      params.push(patientId);
    }
    
    sql += ` ORDER BY 
      CASE severity 
        WHEN 'critical' THEN 1 
        WHEN 'warning' THEN 2 
        WHEN 'info' THEN 3 
        ELSE 4 
      END,
      created_at DESC 
      LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(parseInt(limit), parseInt(skip));
    
    const result = await query(sql, params);
    
    // Get counts
    const countResult = await query('SELECT COUNT(*) FROM alerts');
    const activeResult = await query("SELECT COUNT(*) FROM alerts WHERE status = 'active'");

    res.json({
      alerts: result.rows.map(formatAlert),
      count: {
        total: parseInt(countResult.rows[0].count),
        active: parseInt(activeResult.rows[0].count)
      },
      pagination: {
        limit: parseInt(limit),
        skip: parseInt(skip)
      }
    });

  } catch (error) {
    logger.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// GET /api/alerts/active - Get active alerts
router.get('/active', async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM alerts 
      WHERE status = 'active'
      ORDER BY 
        CASE severity 
          WHEN 'critical' THEN 1 
          WHEN 'warning' THEN 2 
          WHEN 'info' THEN 3 
          ELSE 4 
        END,
        created_at DESC
    `);

    res.json({
      alerts: result.rows.map(formatAlert),
      count: result.rows.length
    });

  } catch (error) {
    logger.error('Error fetching active alerts:', error);
    res.status(500).json({ error: 'Failed to fetch active alerts' });
  }
});

// GET /api/alerts/statistics - Get alert statistics
router.get('/statistics', async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    
    const periodMap = {
      '24h': "created_at >= NOW() - INTERVAL '24 hours'",
      '7d': "created_at >= NOW() - INTERVAL '7 days'",
      '30d': "created_at >= NOW() - INTERVAL '30 days'"
    };
    
    const whereClause = periodMap[period] || periodMap['7d'];
    
    const severityResult = await query(`
      SELECT severity, COUNT(*) as count 
      FROM alerts 
      WHERE ${whereClause}
      GROUP BY severity
    `);
    
    const statusResult = await query(`
      SELECT status, COUNT(*) as count 
      FROM alerts 
      WHERE ${whereClause}
      GROUP BY status
    `);
    
    const typeResult = await query(`
      SELECT type, COUNT(*) as count 
      FROM alerts 
      WHERE ${whereClause}
      GROUP BY type
    `);

    res.json({
      period,
      bySeverity: severityResult.rows.map(r => ({ _id: r.severity, count: parseInt(r.count) })),
      byStatus: statusResult.rows.map(r => ({ _id: r.status, count: parseInt(r.count) })),
      byType: typeResult.rows.map(r => ({ _id: r.type, count: parseInt(r.count) }))
    });

  } catch (error) {
    logger.error('Error fetching alert statistics:', error);
    res.status(500).json({ error: 'Failed to fetch alert statistics' });
  }
});

// POST /api/alerts - Create new alert
router.post('/', async (req, res) => {
  try {
    const alertData = req.body;
    
    // Generate alert ID if not provided
    const alertId = alertData.alertId || `ALT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const result = await query(`
      INSERT INTO alerts (alert_id, patient_id, device_id, type, severity, title, message, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      alertId,
      alertData.patientId,
      alertData.deviceId,
      alertData.type,
      alertData.severity,
      alertData.title,
      alertData.message,
      alertData.status || 'active'
    ]);

    logger.info(`New alert created: ${alertId}`);

    // Emit real-time alert
    const io = req.app.get('io');
    io.emit('newAlert', formatAlert(result.rows[0]));

    res.status(201).json(formatAlert(result.rows[0]));

  } catch (error) {
    logger.error('Error creating alert:', error);
    res.status(500).json({ error: 'Failed to create alert' });
  }
});

// PUT /api/alerts/:alertId/acknowledge - Acknowledge alert
router.put('/:alertId/acknowledge', async (req, res) => {
  try {
    const { alertId } = req.params;
    const { userId } = req.body;

    const result = await query(`
      UPDATE alerts 
      SET status = 'acknowledged',
          acknowledged_by = $1,
          acknowledged_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE alert_id = $2 AND status = 'active'
      RETURNING *
    `, [userId, alertId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found or already processed' });
    }

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('alertAcknowledged', formatAlert(result.rows[0]));

    res.json({
      success: true,
      alert: formatAlert(result.rows[0])
    });

  } catch (error) {
    logger.error('Error acknowledging alert:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

// PUT /api/alerts/:alertId/resolve - Resolve alert
router.put('/:alertId/resolve', async (req, res) => {
  try {
    const { alertId } = req.params;
    const { userId, method, notes } = req.body;

    const result = await query(`
      UPDATE alerts 
      SET status = 'resolved',
          resolved_by = $1,
          resolved_at = CURRENT_TIMESTAMP,
          resolution_method = $2,
          resolution_notes = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE alert_id = $4
      RETURNING *
    `, [userId, method, notes, alertId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('alertResolved', formatAlert(result.rows[0]));

    res.json({
      success: true,
      alert: formatAlert(result.rows[0])
    });

  } catch (error) {
    logger.error('Error resolving alert:', error);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

module.exports = router;
