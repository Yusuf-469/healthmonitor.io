/**
 * Devices Routes
 * API endpoints for device management
 */

const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const { logger } = require('../utils/logger');

// GET /api/devices - Get all devices
router.get('/', async (req, res) => {
  try {
    const { status, patientId, limit = 100, skip = 0 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (patientId) query.patientId = patientId;

    const devices = await Device.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));

    const total = await Device.countDocuments(query);

    res.json({
      devices,
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
    const stats = await Device.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      statusCounts: stats,
      total: stats.reduce((acc, s) => acc + s.count, 0)
    });

  } catch (error) {
    logger.error('Error fetching device stats:', error);
    res.status(500).json({ error: 'Failed to fetch device statistics' });
  }
});

// GET /api/devices/:deviceId - Get single device
router.get('/:deviceId', async (req, res) => {
  try {
    const device = await Device.findOne({ deviceId: req.params.deviceId });
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json(device);

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
    if (!deviceData.deviceId) {
      deviceData.deviceId = `DEV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    }

    const device = new Device(deviceData);
    await device.save();

    logger.info(`New device created: ${device.deviceId}`);

    res.status(201).json(device);

  } catch (error) {
    logger.error('Error creating device:', error);
    if (error.code === 11000) {
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

    // Don't allow updating deviceId
    delete updates.deviceId;
    delete updates.createdAt;

    const device = await Device.findOneAndUpdate(
      { deviceId },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json({
      success: true,
      device
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

    const device = await Device.findOneAndUpdate(
      { deviceId },
      { $set: { status } },
      { new: true }
    );

    if (!device) {
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
      device
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

    const result = await Device.deleteOne({ deviceId });

    if (result.deletedCount === 0) {
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
