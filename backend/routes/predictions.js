/**
 * Predictions Routes
 * API endpoints for AI/ML health predictions
 */

const express = require('express');
const router = express.Router();
const { predictHealthRisk, getRiskHistory, trainModel } = require('../services/predictionService');
const HealthData = require('../models/HealthData');
const Alert = require('../models/Alert');
const Patient = require('../models/Patient');
const { logger } = require('../utils/logger');

// POST /api/predictions/risk - Predict health risk for patient
router.post('/risk', async (req, res) => {
  try {
    const { patientId, historicalData = true } = req.body;

    if (!patientId) {
      return res.status(400).json({ error: 'Patient ID is required' });
    }

    // Get historical data if requested
    let historicalReadings = [];
    if (historicalData) {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
      
      historicalReadings = await HealthData.find({
        patientId,
        timestamp: { $gte: startDate, $lte: endDate }
      }).sort({ timestamp: -1 }).limit(100);
    }

    // Make prediction
    const prediction = await predictHealthRisk(patientId, historicalReadings);

    // Create prediction alert if risk is high
    if (prediction.riskLevel === 'high' || prediction.riskLevel === 'critical') {
      const alert = new Alert({
        patientId,
        type: 'prediction',
        severity: prediction.riskLevel === 'critical' ? 'critical' : 'warning',
        title: `Health Risk Prediction: ${prediction.riskLevel.toUpperCase()}`,
        message: prediction.recommendation,
        data: {
          riskScore: prediction.riskScore,
          factors: prediction.factors,
          confidence: prediction.confidence
        },
        triggeredBy: {
          predictionId: prediction.predictionId
        }
      });
      await alert.save();

      // Emit real-time alert
      const io = req.app.get('io');
      io.to(`patient-${patientId}`).emit('predictionAlert', {
        alert,
        prediction
      });
    }

    res.json({
      predictionId: prediction.predictionId,
      patientId,
      riskLevel: prediction.riskLevel,
      riskScore: prediction.riskScore,
      factors: prediction.factors,
      recommendation: prediction.recommendation,
      confidence: prediction.confidence,
      timestamp: prediction.timestamp
    });

  } catch (error) {
    logger.error('Error predicting health risk:', error);
    res.status(500).json({ error: 'Failed to predict health risk' });
  }
});

// GET /api/predictions/:patientId/history - Get patient's prediction history
router.get('/:patientId/history', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { limit = 50, startDate, endDate } = req.query;

    const query = {
      patientId,
      type: 'prediction',
      status: 'active'
    };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const predictions = await Alert.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      patientId,
      predictions
    });

  } catch (error) {
    logger.error('Error fetching prediction history:', error);
    res.status(500).json({ error: 'Failed to fetch prediction history' });
  }
});

// POST /api/predictions/train - Train the prediction model
router.post('/train', async (req, res) => {
  try {
    const { patientIds, force = false } = req.body;

    logger.info('Starting model training...');
    
    const result = await trainModel(patientIds, force);

    res.json({
      success: true,
      message: 'Model training completed',
      result
    });

  } catch (error) {
    logger.error('Error training model:', error);
    res.status(500).json({ error: 'Failed to train model' });
  }
});

// GET /api/predictions/model/status - Get model status
router.get('/model/status', async (req, res) => {
  try {
    const { getRiskHistory } = require('../services/predictionService');
    
    const status = {
      modelLoaded: true,
      lastTrained: new Date(),
      accuracy: 0.89, // Placeholder - would be from actual model metrics
      metrics: {
        precision: 0.87,
        recall: 0.85,
        f1Score: 0.86,
        auc: 0.92
      },
      features: [
        'heartRate',
        'temperature',
        'spo2',
        'bloodPressure_systolic',
        'bloodPressure_diastolic',
        'heartRate_variability',
        'temperature_trend',
        'spo2_trend'
      ]
    };

    res.json(status);

  } catch (error) {
    logger.error('Error getting model status:', error);
    res.status(500).json({ error: 'Failed to get model status' });
  }
});

// GET /api/predictions/anomaly/:patientId - Detect anomalies in recent data
router.get('/anomaly/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { threshold = 0.7 } = req.query;

    const recentData = await HealthData.find({ patientId })
      .sort({ timestamp: -1 })
      .limit(50);

    if (recentData.length < 10) {
      return res.json({
        patientId,
        message: 'Insufficient data for anomaly detection',
        anomalies: []
      });
    }

    // Simple anomaly detection based on statistical analysis
    const anomalies = [];
    const stats = {
      heartRate: { mean: 0, std: 0 },
      temperature: { mean: 0, std: 0 },
      spo2: { mean: 0, std: 0 }
    };

    // Calculate statistics
    ['heartRate', 'temperature', 'spo2'].forEach(metric => {
      const values = recentData.map(d => d[metric]?.value || 0).filter(v => v > 0);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
      stats[metric] = { mean, std: Math.sqrt(variance) };
    });

    // Detect anomalies
    recentData.forEach((reading, index) => {
      ['heartRate', 'temperature', 'spo2'].forEach(metric => {
        const value = reading[metric]?.value;
        if (value > 0) {
          const zScore = Math.abs((value - stats[metric].mean) / (stats[metric].std || 1));
          if (zScore > 2) { // More than 2 standard deviations
            anomalies.push({
              timestamp: reading.timestamp,
              metric,
              value,
              mean: stats[metric].mean,
              zScore,
              severity: zScore > 3 ? 'high' : 'medium'
            });
          }
        }
      });
    });

    res.json({
      patientId,
      anomalies: anomalies.slice(0, 20), // Limit to 20 anomalies
      statistics: stats,
      analyzedReadings: recentData.length
    });

  } catch (error) {
    logger.error('Error detecting anomalies:', error);
    res.status(500).json({ error: 'Failed to detect anomalies' });
  }
});

module.exports = router;
