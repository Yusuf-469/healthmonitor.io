/**
 * Health Data Routes
 * API endpoints for health data ingestion and retrieval
 */

const express = require('express');
const router = express.Router();
const HealthData = require('../models/HealthData');
const Patient = require('../models/Patient');
const Device = require('../models/Device');
const { logger } = require('../utils/logger');
const { predictHealthRisk } = require('../services/predictionService');

// POST /api/health-data - Receive health data from devices
router.post('/', async (req, res) => {
  try {
    const {
      patientId,
      deviceId,
      heartRate,
      temperature,
      spo2,
      bloodPressure,
      ecg,
      respiration,
      metadata
    } = req.body;

    // Validate required fields
    if (!patientId || !deviceId) {
      return res.status(400).json({ 
        error: 'Missing required fields: patientId and deviceId' 
      });
    }

    // Create health data record
    const healthData = new HealthData({
      patientId,
      deviceId,
      heartRate: {
        value: heartRate?.value || heartRate,
        unit: heartRate?.unit || 'bpm',
        quality: heartRate?.quality || 'good'
      },
      temperature: {
        value: temperature?.value || temperature,
        unit: temperature?.unit || '°C',
        method: temperature?.method || 'axillary'
      },
      spo2: {
        value: spo2?.value || spo2,
        unit: spo2?.unit || '%',
        quality: spo2?.quality || 'good'
      },
      bloodPressure: bloodPressure || {},
      ecg: ecg || {},
      respiration: respiration || {},
      metadata: metadata || {}
    });

    // Assess status and generate alerts
    const patient = await Patient.findOne({ patientId });
    if (patient) {
      const alerts = patient.isAbnormalReading({
        heartRate: healthData.heartRate.value,
        temperature: healthData.temperature.value,
        spo2: healthData.spo2.value,
        bloodPressure: healthData.bloodPressure
      });

      if (alerts.length > 0) {
        healthData.alerts = alerts;
        healthData.status = alerts.some(a => a.severity === 'critical') ? 'critical' : 'warning';
        
        // Emit real-time alert
        const io = req.app.get('io');
        io.to(`patient-${patientId}`).emit('alert', {
          patientId,
          alerts,
          data: healthData
        });
      } else {
        healthData.status = 'normal';
      }

      // Update patient's last reading
      await Patient.findOneAndUpdate(
        { patientId },
        {
          lastReading: {
            timestamp: new Date(),
            heartRate: healthData.heartRate.value,
            temperature: healthData.temperature.value,
            spo2: healthData.spo2.value,
            bloodPressure: healthData.bloodPressure
          }
        }
      );
    }

    // Update device last seen
    await Device.findOneAndUpdate(
      { deviceId },
      {
        lastSeen: new Date(),
        status: 'online',
        lastData: {
          timestamp: new Date(),
          heartRate: healthData.heartRate.value,
          temperature: healthData.temperature.value,
          spo2: healthData.spo2.value
        }
      }
    );

    // Save health data
    await healthData.save();

    // Emit real-time data update
    const io = req.app.get('io');
    io.to(`patient-${patientId}`).emit('healthData', healthData);

    logger.info(`Health data received from ${deviceId} for patient ${patientId}`);

    res.status(201).json({
      success: true,
      data: healthData,
      alerts: healthData.alerts || []
    });

  } catch (error) {
    logger.error('Error processing health data:', error);
    res.status(500).json({ 
      error: 'Failed to process health data',
      message: error.message 
    });
  }
});

// POST /api/health-data/batch - Receive batch health data
router.post('/batch', async (req, res) => {
  try {
    const { readings } = req.body;

    if (!readings || !Array.isArray(readings)) {
      return res.status(400).json({ error: 'Invalid batch data' });
    }

    const results = [];
    for (const reading of readings) {
      try {
        const healthData = new HealthData(reading);
        await healthData.save();
        results.push({ success: true, data: healthData });
      } catch (err) {
        results.push({ success: false, error: err.message, data: reading });
      }
    }

    res.status(201).json({
      success: true,
      total: readings.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    });

  } catch (error) {
    logger.error('Error processing batch health data:', error);
    res.status(500).json({ 
      error: 'Failed to process batch health data',
      message: error.message 
    });
  }
});

// GET /api/health-data/:patientId - Get patient health data
router.get('/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { 
      startDate, 
      endDate, 
      limit = 100, 
      skip = 0,
      sort = '-timestamp',
      interval
    } = req.query;

    const query = { patientId };

    // Date range filter
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    // Time series aggregation if interval specified
    if (interval) {
      const startTime = startDate ? new Date(startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endTime = endDate ? new Date(endDate) : new Date();
      
      const timeSeries = await HealthData.getTimeSeries(patientId, startTime, endTime, interval);
      return res.json({
        patientId,
        interval,
        startDate: startTime,
        endDate: endTime,
        data: timeSeries
      });
    }

    // Regular query
    const data = await HealthData.find(query)
      .sort(sort)
      .skip(parseInt(skip))
      .limit(parseInt(limit));

    const total = await HealthData.countDocuments(query);

    res.json({
      patientId,
      data,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: parseInt(skip) + parseInt(limit) < total
      }
    });

  } catch (error) {
    logger.error('Error fetching health data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch health data',
      message: error.message 
    });
  }
});

// GET /api/health-data/:patientId/latest - Get latest reading
router.get('/:patientId/latest', async (req, res) => {
  try {
    const { patientId } = req.params;

    const data = await HealthData.findOne({ patientId })
      .sort({ timestamp: -1 });

    if (!data) {
      return res.status(404).json({ error: 'No data found for patient' });
    }

    res.json(data);

  } catch (error) {
    logger.error('Error fetching latest health data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch latest health data',
      message: error.message 
    });
  }
});

// GET /api/health-data/:patientId/summary - Get aggregated summary
router.get('/:patientId/summary', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { period = '24h' } = req.query;

    const periodMs = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };

    const startTime = new Date(Date.now() - (periodMs[period] || periodMs['24h']));

    const summary = await HealthData.aggregate([
      {
        $match: {
          patientId,
          timestamp: { $gte: startTime }
        }
      },
      {
        $group: {
          _id: null,
          avgHeartRate: { $avg: '$heartRate.value' },
          minHeartRate: { $min: '$heartRate.value' },
          maxHeartRate: { $max: '$heartRate.value' },
          avgTemperature: { $avg: '$temperature.value' },
          minTemperature: { $min: '$temperature.value' },
          maxTemperature: { $max: '$temperature.value' },
          avgSpo2: { $avg: '$spo2.value' },
          minSpo2: { $min: '$spo2.value' },
          maxSpo2: { $max: '$spo2.value' },
          avgSystolic: { $avg: '$bloodPressure.systolic' },
          avgDiastolic: { $avg: '$bloodPressure.diastolic' },
          totalReadings: { $sum: 1 },
          criticalAlerts: {
            $sum: { $cond: [{ $eq: ['$status', 'critical'] }, 1, 0] }
          },
          warningAlerts: {
            $sum: { $cond: [{ $eq: ['$status', 'warning'] }, 1, 0] }
          },
          firstReading: { $min: '$timestamp' },
          lastReading: { $max: '$timestamp' }
        }
      }
    ]);

    if (summary.length === 0) {
      return res.json({
        patientId,
        period,
        message: 'No data available for the specified period',
        data: null
      });
    }

    res.json({
      patientId,
      period,
      summary: summary[0],
      generatedAt: new Date()
    });

  } catch (error) {
    logger.error('Error fetching health data summary:', error);
    res.status(500).json({ 
      error: 'Failed to fetch health data summary',
      message: error.message 
    });
  }
});

// DELETE /api/health-data/:patientId - Delete patient health data
router.delete('/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { beforeDate } = req.query;

    const query = { patientId };
    if (beforeDate) {
      query.timestamp = { $lt: new Date(beforeDate) };
    }

    const result = await HealthData.deleteMany(query);

    res.json({
      success: true,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    logger.error('Error deleting health data:', error);
    res.status(500).json({ 
      error: 'Failed to delete health data',
      message: error.message 
    });
  }
});

module.exports = router;
