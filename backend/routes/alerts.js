/**
 * Alerts Routes
 * API endpoints for alert management
 */

const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const Patient = require('../models/Patient');
const { logger } = require('../utils/logger');
const { sendNotification } = require('../services/notificationService');

// GET /api/alerts - Get all alerts with filtering
router.get('/', async (req, res) => {
  try {
    const {
      patientId,
      status,
      severity,
      type,
      startDate,
      endDate,
      limit = 50,
      skip = 0
    } = req.query;

    const query = {};
    
    if (patientId) query.patientId = patientId;
    if (status) query.status = status;
    if (severity) query.severity = severity;
    if (type) query.type = type;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const alerts = await Alert.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));

    const total = await Alert.countDocuments(query);

    res.json({
      alerts,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: parseInt(skip) + parseInt(limit) < total
      }
    });

  } catch (error) {
    logger.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// GET /api/alerts/active - Get active critical alerts
router.get('/active', async (req, res) => {
  try {
    const alerts = await Alert.getActiveCritical();
    
    // Enrich with patient data
    const enrichedAlerts = await Promise.all(
      alerts.map(async (alert) => {
        const patient = await Patient.findOne({ patientId: alert.patientId });
        return {
          ...alert.toObject(),
          patientName: patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown'
        };
      })
    );

    res.json({
      count: enrichedAlerts.length,
      alerts: enrichedAlerts
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
    
    const periodMs = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };
    
    const startDate = new Date(Date.now() - (periodMs[period] || periodMs['7d']));
    const endDate = new Date();

    const statistics = await Alert.getStatistics(startDate, endDate);

    res.json({
      period,
      startDate,
      endDate,
      statistics
    });

  } catch (error) {
    logger.error('Error fetching alert statistics:', error);
    res.status(500).json({ error: 'Failed to fetch alert statistics' });
  }
});

// GET /api/alerts/:alertId - Get single alert
router.get('/:alertId', async (req, res) => {
  try {
    const alert = await Alert.findOne({ alertId: req.params.alertId });
    
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json(alert);

  } catch (error) {
    logger.error('Error fetching alert:', error);
    res.status(500).json({ error: 'Failed to fetch alert' });
  }
});

// POST /api/alerts - Create new alert
router.post('/', async (req, res) => {
  try {
    const alertData = req.body;
    
    const alert = new Alert(alertData);
    await alert.save();

    // Send notifications
    const patient = await Patient.findOne({ patientId: alert.patientId });
    if (patient) {
      await sendNotification(patient, alert);
    }

    // Emit real-time alert
    const io = req.app.get('io');
    io.emit('newAlert', alert);

    logger.info(`New alert created: ${alert.alertId}`);

    res.status(201).json(alert);

  } catch (error) {
    logger.error('Error creating alert:', error);
    res.status(500).json({ error: 'Failed to create alert' });
  }
});

// PUT /api/alerts/:alertId/acknowledge - Acknowledge alert
router.put('/:alertId/acknowledge', async (req, res) => {
  try {
    const { userId } = req.body;
    const alert = await Alert.findOne({ alertId: req.params.alertId });
    
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    await alert.acknowledge(userId);

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('alertUpdated', alert);

    res.json({
      success: true,
      message: 'Alert acknowledged',
      alert
    });

  } catch (error) {
    logger.error('Error acknowledging alert:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

// PUT /api/alerts/:alertId/resolve - Resolve alert
router.put('/:alertId/resolve', async (req, res) => {
  try {
    const { userId, method, notes } = req.body;
    const alert = await Alert.findOne({ alertId: req.params.alertId });
    
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    await alert.resolve(userId, method, notes);

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('alertUpdated', alert);

    res.json({
      success: true,
      message: 'Alert resolved',
      alert
    });

  } catch (error) {
    logger.error('Error resolving alert:', error);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

// PUT /api/alerts/:alertId/escalate - Escalate alert
router.put('/:alertId/escalate', async (req, res) => {
  try {
    const { level, escalatedTo, reason } = req.body;
    const alert = await Alert.findOne({ alertId: req.params.alertId });
    
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    await alert.escalate(level, escalatedTo, reason);

    // Send escalation notification
    const patient = await Patient.findOne({ patientId: alert.patientId });
    if (patient) {
      await sendNotification(patient, alert, 'escalation');
    }

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('alertEscalated', alert);

    res.json({
      success: true,
      message: 'Alert escalated',
      alert
    });

  } catch (error) {
    logger.error('Error escalating alert:', error);
    res.status(500).json({ error: 'Failed to escalate alert' });
  }
});

// DELETE /api/alerts/:alertId - Delete alert
router.delete('/:alertId', async (req, res) => {
  try {
    const result = await Alert.deleteOne({ alertId: req.params.alertId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json({
      success: true,
      message: 'Alert deleted'
    });

  } catch (error) {
    logger.error('Error deleting alert:', error);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

module.exports = router;
