/**
 * Patients Routes
 * API endpoints for patient management
 */

const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const Device = require('../models/Device');
const HealthData = require('../models/HealthData');
const { logger } = require('../utils/logger');

// GET /api/patients - Get all patients
router.get('/', async (req, res) => {
  try {
    const { status, search, limit = 50, skip = 0 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (search) {
      query.$text = { $search: search };
    }

    const patients = await Patient.find(query)
      .select('-medicalHistory.medications')
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));

    const total = await Patient.countDocuments(query);

    res.json({
      patients,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: parseInt(skip) + parseInt(limit) < total
      }
    });

  } catch (error) {
    logger.error('Error fetching patients:', error);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// GET /api/patients/stats - Get patient statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await Patient.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const ageGroups = await Patient.aggregate([
      {
        $addFields: {
          age: {
            $floor: {
              $divide: [
                { $subtract: [new Date(), '$dateOfBirth'] },
                31536000000 // milliseconds in year
              ]
            }
          }
        }
      },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $lt: ['$age', 18] }, then: 'under_18' },
                { case: { $lt: ['$age', 40] }, then: '18-40' },
                { case: { $lt: ['$age', 60] }, then: '40-60' },
                { case: { $gte: ['$age', 60] }, then: '60+' }
              ],
              default: 'unknown'
            }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      statusCounts: stats,
      ageGroups
    });

  } catch (error) {
    logger.error('Error fetching patient stats:', error);
    res.status(500).json({ error: 'Failed to fetch patient statistics' });
  }
});

// GET /api/patients/:patientId - Get single patient
router.get('/:patientId', async (req, res) => {
  try {
    const patient = await Patient.findOne({ patientId: req.params.patientId });
    
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Get associated devices
    const devices = await Device.find({ patientId: patient.patientId });
    
    // Get recent health data
    const recentData = await HealthData.find({ patientId: patient.patientId })
      .sort({ timestamp: -1 })
      .limit(10);

    res.json({
      patient,
      devices,
      recentData
    });

  } catch (error) {
    logger.error('Error fetching patient:', error);
    res.status(500).json({ error: 'Failed to fetch patient' });
  }
});

// POST /api/patients - Create new patient
router.post('/', async (req, res) => {
  try {
    const patientData = req.body;
    
    // Generate patient ID if not provided
    if (!patientData.patientId) {
      patientData.patientId = `PAT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    }

    const patient = new Patient(patientData);
    await patient.save();

    logger.info(`New patient created: ${patient.patientId}`);

    res.status(201).json(patient);

  } catch (error) {
    logger.error('Error creating patient:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Patient ID or email already exists' });
    }
    res.status(500).json({ error: 'Failed to create patient' });
  }
});

// PUT /api/patients/:patientId - Update patient
router.put('/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const updates = req.body;

    // Don't allow updating patientId
    delete updates.patientId;
    delete updates.createdAt;
    delete updates.updatedAt;

    const patient = await Patient.findOneAndUpdate(
      { patientId },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json({
      success: true,
      patient
    });

  } catch (error) {
    logger.error('Error updating patient:', error);
    res.status(500).json({ error: 'Failed to update patient' });
  }
});

// PUT /api/patients/:patientId/alert-settings - Update alert settings
router.put('/:patientId/alert-settings', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { alertSettings } = req.body;

    const patient = await Patient.findOneAndUpdate(
      { patientId },
      { $set: { alertSettings } },
      { new: true }
    );

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json({
      success: true,
      alertSettings: patient.alertSettings
    });

  } catch (error) {
    logger.error('Error updating alert settings:', error);
    res.status(500).json({ error: 'Failed to update alert settings' });
  }
});

// PUT /api/patients/:patientId/status - Update patient status
router.put('/:patientId/status', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { status } = req.body;

    const validStatuses = ['active', 'inactive', 'critical', 'discharged'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const patient = await Patient.findOneAndUpdate(
      { patientId },
      { $set: { status } },
      { new: true }
    );

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Emit real-time status update
    const io = req.app.get('io');
    io.to(`patient-${patientId}`).emit('patientStatus', {
      patientId,
      status
    });

    res.json({
      success: true,
      patient
    });

  } catch (error) {
    logger.error('Error updating patient status:', error);
    res.status(500).json({ error: 'Failed to update patient status' });
  }
});

// POST /api/patients/:patientId/devices - Assign device to patient
router.post('/:patientId/devices', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { deviceId } = req.body;

    // Check if device exists
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Update device with patient
    await Device.findOneAndUpdate(
      { deviceId },
      { $set: { patientId, status: 'online' } }
    );

    // Add device to patient
    const patient = await Patient.findOneAndUpdate(
      { patientId },
      { $addToSet: { assignedDevices: device._id } },
      { new: true }
    );

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json({
      success: true,
      patient,
      device
    });

  } catch (error) {
    logger.error('Error assigning device:', error);
    res.status(500).json({ error: 'Failed to assign device' });
  }
});

// DELETE /api/patients/:patientId - Delete patient
router.delete('/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;

    // Remove patient association from devices
    await Device.updateMany(
      { patientId },
      { $unset: { patientId: '' } }
    );

    // Delete patient
    const result = await Patient.deleteOne({ patientId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json({
      success: true,
      message: 'Patient deleted'
    });

  } catch (error) {
    logger.error('Error deleting patient:', error);
    res.status(500).json({ error: 'Failed to delete patient' });
  }
});

module.exports = router;
