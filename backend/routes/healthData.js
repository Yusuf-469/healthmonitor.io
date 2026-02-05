/**
 * Health Data Routes
 * API endpoints for health data - PostgreSQL version
 */

const express = require('express');
const router = express.Router();
const { query } = require('../database');
const { logger } = require('../utils/logger');

// Helper to format health data from DB row
const formatHealthData = (row) => ({
  id: row.id,
  patientId: row.patient_id,
  deviceId: row.device_id,
  heartRate: row.heart_rate,
  temperature: row.temperature,
  spo2: row.spo2,
  bloodPressure: {
    systolic: row.blood_pressure_systolic,
    diastolic: row.blood_pressure_diastolic
  },
  status: row.status,
  timestamp: row.timestamp
});

// GET /api/health-data/:patientId - Get health data for patient
router.get('/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { limit = 100, skip = 0, period } = req.query;
    
    let sql = `
      SELECT * FROM health_data 
      WHERE patient_id = $1
    `;
    
    const params = [patientId];
    let paramIndex = 2;
    
    // Add period filter if provided
    if (period) {
      const periodMap = {
        '1h': "timestamp >= NOW() - INTERVAL '1 hour'",
        '24h': "timestamp >= NOW() - INTERVAL '24 hours'",
        '7d': "timestamp >= NOW() - INTERVAL '7 days'",
        '30d': "timestamp >= NOW() - INTERVAL '30 days'"
      };
      
      if (periodMap[period]) {
        sql += ` AND ${periodMap[period]}`;
      }
    }
    
    sql += ` ORDER BY timestamp DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(parseInt(limit), parseInt(skip));
    
    const result = await query(sql, params);
    
    // Get total count
    const countResult = await query(
      'SELECT COUNT(*) FROM health_data WHERE patient_id = $1',
      [patientId]
    );
    const total = parseInt(countResult.rows[0].count);

    res.json({
      data: result.rows.map(formatHealthData),
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip)
      }
    });

  } catch (error) {
    logger.error('Error fetching health data:', error);
    res.status(500).json({ error: 'Failed to fetch health data' });
  }
});

// GET /api/health-data/:patientId/latest - Get latest reading
router.get('/:patientId/latest', async (req, res) => {
  try {
    const { patientId } = req.params;
    
    const result = await query(`
      SELECT * FROM health_data 
      WHERE patient_id = $1 
      ORDER BY timestamp DESC 
      LIMIT 1
    `, [patientId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No health data found' });
    }

    res.json(formatHealthData(result.rows[0]));

  } catch (error) {
    logger.error('Error fetching latest reading:', error);
    res.status(500).json({ error: 'Failed to fetch latest reading' });
  }
});

// GET /api/health-data/:patientId/summary - Get health summary
router.get('/:patientId/summary', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { period = '24h' } = req.query;
    
    const periodMap = {
      '1h': "timestamp >= NOW() - INTERVAL '1 hour'",
      '24h': "timestamp >= NOW() - INTERVAL '24 hours'",
      '7d': "timestamp >= NOW() - INTERVAL '7 days'",
      '30d': "timestamp >= NOW() - INTERVAL '30 days'"
    };
    
    const whereClause = periodMap[period] || periodMap['24h'];
    
    const result = await query(`
      SELECT 
        COUNT(*) as readings,
        AVG(heart_rate) as avg_heart_rate,
        MIN(heart_rate) as min_heart_rate,
        MAX(heart_rate) as max_heart_rate,
        AVG(temperature) as avg_temperature,
        MIN(temperature) as min_temperature,
        MAX(temperature) as max_temperature,
        AVG(spo2) as avg_spo2,
        MIN(spo2) as min_spo2,
        MAX(spo2) as max_spo2,
        AVG(blood_pressure_systolic) as avg_bp_systolic,
        AVG(blood_pressure_diastolic) as avg_bp_diastolic,
        COUNT(CASE WHEN status = 'normal' THEN 1 END) as normal_readings,
        COUNT(CASE WHEN status = 'warning' THEN 1 END) as warning_readings,
        COUNT(CASE WHEN status = 'critical' THEN 1 END) as critical_readings
      FROM health_data 
      WHERE patient_id = $1 AND ${whereClause}
    `, [patientId]);
    
    const row = result.rows[0];
    
    res.json({
      period,
      summary: {
        readings: parseInt(row.readings),
        heartRate: {
          average: Math.round(row.avg_heart_rate * 10) / 10,
          min: parseInt(row.min_heart_rate),
          max: parseInt(row.max_heart_rate)
        },
        temperature: {
          average: Math.round(row.avg_temperature * 10) / 10,
          min: parseFloat(row.min_temperature),
          max: parseFloat(row.max_temperature)
        },
        spo2: {
          average: Math.round(row.avg_spo2 * 10) / 10,
          min: parseInt(row.min_spo2),
          max: parseInt(row.max_spo2)
        },
        bloodPressure: {
          systolic: Math.round(row.avg_bp_systolic),
          diastolic: Math.round(row.avg_bp_diastolic)
        },
        status: {
          normal: parseInt(row.normal_readings),
          warning: parseInt(row.warning_readings),
          critical: parseInt(row.critical_readings)
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching health summary:', error);
    res.status(500).json({ error: 'Failed to fetch health summary' });
  }
});

// POST /api/health-data - Submit health data
router.post('/', async (req, res) => {
  try {
    const { patientId, deviceId, heartRate, temperature, spo2, bloodPressure, status } = req.body;
    
    // Validate required fields
    if (!patientId) {
      return res.status(400).json({ error: 'Patient ID is required' });
    }

    const result = await query(`
      INSERT INTO health_data (patient_id, device_id, heart_rate, temperature, spo2, blood_pressure_systolic, blood_pressure_diastolic, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      patientId,
      deviceId,
      heartRate,
      temperature,
      spo2,
      bloodPressure?.systolic,
      bloodPressure?.diastolic,
      status || 'normal'
    ]);

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`patient-${patientId}`).emit('healthData', formatHealthData(result.rows[0]));

    res.status(201).json(formatHealthData(result.rows[0]));

  } catch (error) {
    logger.error('Error submitting health data:', error);
    res.status(500).json({ error: 'Failed to submit health data' });
  }
});

// POST /api/health-data/bulk - Submit multiple readings
router.post('/bulk', async (req, res) => {
  try {
    const { patientId, deviceId, readings } = req.body;
    
    if (!readings || readings.length === 0) {
      return res.status(400).json({ error: 'No readings provided' });
    }

    const inserted = [];
    
    for (const reading of readings) {
      const result = await query(`
        INSERT INTO health_data (patient_id, device_id, heart_rate, temperature, spo2, blood_pressure_systolic, blood_pressure_diastolic, status, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        patientId,
        deviceId,
        reading.heartRate,
        reading.temperature,
        reading.spo2,
        reading.bloodPressure?.systolic,
        reading.bloodPressure?.diastolic,
        reading.status || 'normal',
        reading.timestamp || new Date()
      ]);
      inserted.push(formatHealthData(result.rows[0]));
    }

    // Emit real-time update for latest reading
    if (inserted.length > 0) {
      const io = req.app.get('io');
      io.to(`patient-${patientId}`).emit('healthData', inserted[inserted.length - 1]);
    }

    res.status(201).json({
      success: true,
      inserted: inserted.length,
      data: inserted
    });

  } catch (error) {
    logger.error('Error bulk inserting health data:', error);
    res.status(500).json({ error: 'Failed to bulk insert health data' });
  }
});

module.exports = router;
