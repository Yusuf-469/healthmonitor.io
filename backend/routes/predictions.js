/**
 * Predictions Routes
 * AI-based health risk predictions - PostgreSQL version
 */

const express = require('express');
const router = express.Router();
const { query } = require('../database');
const { logger } = require('../utils/logger');

// Simple risk prediction based on health data
const calculateRiskScore = (healthData) => {
  let riskScore = 0;
  const factors = [];
  
  // Heart rate analysis
  if (healthData.heartRate > 100) {
    riskScore += 30;
    factors.push({ factor: 'High Heart Rate', weight: 30, value: healthData.heartRate });
  } else if (healthData.heartRate > 90) {
    riskScore += 15;
    factors.push({ factor: 'Elevated Heart Rate', weight: 15, value: healthData.heartRate });
  } else if (healthData.heartRate < 50) {
    riskScore += 20;
    factors.push({ factor: 'Low Heart Rate', weight: 20, value: healthData.heartRate });
  }
  
  // Temperature analysis
  if (healthData.temperature > 38) {
    riskScore += 25;
    factors.push({ factor: 'Fever', weight: 25, value: healthData.temperature });
  } else if (healthData.temperature > 37.5) {
    riskScore += 10;
    factors.push({ factor: 'Slight Fever', weight: 10, value: healthData.temperature });
  }
  
  // SpO2 analysis
  if (healthData.spo2 < 90) {
    riskScore += 35;
    factors.push({ factor: 'Low Oxygen', weight: 35, value: healthData.spo2 });
  } else if (healthData.spo2 < 95) {
    riskScore += 15;
    factors.push({ factor: 'Below Normal Oxygen', weight: 15, value: healthData.spo2 });
  }
  
  // Blood pressure analysis
  if (healthData.bloodPressure) {
    if (healthData.bloodPressure.systolic > 140) {
      riskScore += 20;
      factors.push({ factor: 'High Systolic BP', weight: 20, value: healthData.bloodPressure.systolic });
    }
    if (healthData.bloodPressure.diastolic > 90) {
      riskScore += 15;
      factors.push({ factor: 'High Diastolic BP', weight: 15, value: healthData.bloodPressure.diastolic });
    }
  }
  
  // Determine risk level
  let riskLevel = 'low';
  if (riskScore >= 70) {
    riskLevel = 'critical';
  } else if (riskScore >= 40) {
    riskLevel = 'high';
  } else if (riskScore >= 20) {
    riskLevel = 'moderate';
  }
  
  return {
    score: Math.min(riskScore, 100),
    level: riskLevel,
    factors
  };
};

// POST /api/predictions/risk - Predict health risk
router.post('/risk', async (req, res) => {
  try {
    const { patientId, historicalData: useHistorical = true } = req.body;
    
    if (!patientId) {
      return res.status(400).json({ error: 'Patient ID is required' });
    }
    
    // Get latest health data
    const latestResult = await query(`
      SELECT * FROM health_data 
      WHERE patient_id = $1 
      ORDER BY timestamp DESC 
      LIMIT 1
    `, [patientId]);
    
    if (latestResult.rows.length === 0) {
      return res.status(404).json({ error: 'No health data found for patient' });
    }
    
    const latestData = latestResult.rows[0];
    const healthData = {
      heartRate: latestData.heart_rate,
      temperature: latestData.temperature,
      spo2: latestData.spo2,
      bloodPressure: latestData.blood_pressure_systolic ? {
        systolic: latestData.blood_pressure_systolic,
        diastolic: latestData.blood_pressure_diastolic
      } : null
    };
    
    // Calculate risk
    const risk = calculateRiskScore(healthData);
    
    // Get patient info
    const patientResult = await query(
      'SELECT first_name, last_name FROM patients WHERE patient_id = $1',
      [patientId]
    );
    
    const prediction = {
      patientId,
      patientName: patientResult.rows[0] 
        ? `${patientResult.rows[0].first_name} ${patientResult.rows[0].last_name}`
        : 'Unknown',
      timestamp: new Date().toISOString(),
      risk: {
        score: risk.score,
        level: risk.level,
        factors: risk.factors,
        recommendation: getRecommendation(risk.level)
      },
      latestData: healthData
    };
    
    logger.info(`Risk prediction for ${patientId}: ${risk.level}`);
    
    res.json(prediction);
    
  } catch (error) {
    logger.error('Error predicting risk:', error);
    res.status(500).json({ error: 'Failed to predict risk' });
  }
});

// GET /api/predictions/:patientId/history - Get prediction history
router.get('/:patientId/history', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { limit = 50 } = req.query;
    
    // Get recent predictions (we store them temporarily)
    // For now, calculate from recent health data
    const result = await query(`
      SELECT 
        timestamp,
        heart_rate,
        temperature,
        spo2,
        blood_pressure_systolic,
        blood_pressure_diastolic,
        status
      FROM health_data 
      WHERE patient_id = $1 
      ORDER BY timestamp DESC 
      LIMIT $2
    `, [patientId, parseInt(limit)]);
    
    const predictions = result.rows.map(row => {
      const healthData = {
        heartRate: row.heart_rate,
        temperature: row.temperature,
        spo2: row.spo2,
        bloodPressure: row.blood_pressure_systolic ? {
          systolic: row.blood_pressure_systolic,
          diastolic: row.blood_pressure_diastolic
        } : null
      };
      
      const risk = calculateRiskScore(healthData);
      
      return {
        patientId,
        timestamp: row.timestamp,
        risk: {
          score: risk.score,
          level: risk.level
        },
        healthData
      };
    });
    
    res.json({
      patientId,
      predictions: predictions.reverse(),
      count: predictions.length
    });
    
  } catch (error) {
    logger.error('Error fetching prediction history:', error);
    res.status(500).json({ error: 'Failed to fetch prediction history' });
  }
});

// Helper to get recommendation based on risk level
function getRecommendation(level) {
  const recommendations = {
    critical: 'IMMEDIATE ATTENTION REQUIRED. Contact healthcare provider immediately.',
    high: 'Elevated risk detected. Monitor closely and consider consulting a doctor.',
    moderate: 'Some risk factors present. Continue monitoring and maintain healthy habits.',
    low: 'Health parameters within normal range. Keep up the good work!'
  };
  
  return recommendations[level] || 'Unable to assess risk level.';
}

module.exports = router;
