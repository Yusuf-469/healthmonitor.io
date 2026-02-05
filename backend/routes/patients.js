/**
 * Patients Routes
 * API endpoints for patient management - PostgreSQL version
 */

const express = require('express');
const router = express.Router();
const { query } = require('../database');
const { logger } = require('../utils/logger');

// Helper to format patient from DB row
const formatPatient = (row) => ({
  id: row.id,
  patientId: row.patient_id,
  firstName: row.first_name,
  lastName: row.last_name,
  email: row.email,
  phone: row.phone,
  dateOfBirth: row.date_of_birth,
  gender: row.gender,
  status: row.status,
  address: row.address,
  emergencyContact: row.emergency_contact,
  medicalNotes: row.medical_notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

// GET /api/patients - Get all patients
router.get('/', async (req, res) => {
  try {
    const { status, search, limit = 50, skip = 0 } = req.query;
    
    let sql = `
      SELECT p.*, 
        (SELECT json_agg(json_build_object('device_id', d.device_id, 'status', d.status)) 
         FROM devices d WHERE d.patient_id = p.patient_id) as devices,
        (SELECT json_build_object(
          'timestamp', h.timestamp,
          'heartRate', h.heart_rate,
          'temperature', h.temperature,
          'spo2', h.spo2,
          'bloodPressure', json_build_object('systolic', h.blood_pressure_systolic, 'diastolic', h.blood_pressure_diastolic)
        ) FROM health_data h 
        WHERE h.patient_id = p.patient_id 
        ORDER BY h.timestamp DESC 
        LIMIT 1) as last_reading
      FROM patients p
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (status) {
      sql += ` AND p.status = $${paramIndex++}`;
      params.push(status);
    }
    
    if (search) {
      sql += ` AND (p.first_name ILIKE $${paramIndex} OR p.last_name ILIKE $${paramIndex} OR p.patient_id ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    sql += ` ORDER BY p.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(parseInt(limit), parseInt(skip));
    
    const result = await query(sql, params);
    
    // Get total count
    let countSql = 'SELECT COUNT(*) FROM patients WHERE 1=1';
    const countParams = [];
    
    if (status) {
      countSql += ' AND status = $1';
      countParams.push(status);
    }
    
    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      patients: result.rows.map(row => ({
        ...formatPatient(row),
        assignedDevices: row.devices || [],
        lastReading: row.last_reading
      })),
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
    const statusResult = await query(`
      SELECT status, COUNT(*) as count 
      FROM patients 
      GROUP BY status
    `);

    const ageResult = await query(`
      SELECT 
        CASE 
          WHEN age < 18 THEN 'under_18'
          WHEN age < 40 THEN '18-40'
          WHEN age < 60 THEN '40-60'
          ELSE '60+'
        END as age_group,
        COUNT(*) as count
      FROM (
        SELECT EXTRACT(YEAR FROM AGE(date_of_birth)) as age
        FROM patients WHERE date_of_birth IS NOT NULL
      ) sub
      GROUP BY age_group
    `);

    res.json({
      statusCounts: statusResult.rows.map(r => ({ _id: r.status, count: parseInt(r.count) })),
      ageGroups: ageResult.rows.map(r => ({ _id: r.age_group, count: parseInt(r.count) }))
    });

  } catch (error) {
    logger.error('Error fetching patient stats:', error);
    res.status(500).json({ error: 'Failed to fetch patient statistics' });
  }
});

// GET /api/patients/:patientId - Get single patient
router.get('/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    
    const result = await query(`
      SELECT p.*,
        (SELECT json_agg(json_build_object('id', d.id, 'deviceId', d.device_id, 'type', d.type, 'status', d.status, 'firmware', d.firmware)) 
         FROM devices d WHERE d.patient_id = p.patient_id) as devices,
        (SELECT json_agg(json_build_object(
          'timestamp', h.timestamp,
          'heartRate', h.heart_rate,
          'temperature', h.temperature,
          'spo2', h.spo2,
          'bloodPressure', json_build_object('systolic', h.blood_pressure_systolic, 'diastolic', h.blood_pressure_diastolic)
        ) ORDER BY h.timestamp DESC LIMIT 10)
        FROM health_data h WHERE h.patient_id = p.patient_id) as recent_data
      FROM patients p
      WHERE p.patient_id = $1
    `, [patientId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const row = result.rows[0];
    res.json({
      patient: formatPatient(row),
      devices: row.devices || [],
      recentData: row.recent_data || []
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
    const patientId = patientData.patientId || `PAT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const result = await query(`
      INSERT INTO patients (patient_id, first_name, last_name, email, phone, date_of_birth, gender, status, address, emergency_contact, medical_notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      patientId,
      patientData.firstName,
      patientData.lastName,
      patientData.email,
      patientData.phone,
      patientData.dateOfBirth,
      patientData.gender,
      patientData.status || 'active',
      patientData.address,
      patientData.emergencyContact,
      patientData.medicalNotes
    ]);

    logger.info(`New patient created: ${patientId}`);

    res.status(201).json(formatPatient(result.rows[0]));

  } catch (error) {
    logger.error('Error creating patient:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Patient ID already exists' });
    }
    res.status(500).json({ error: 'Failed to create patient' });
  }
});

// PUT /api/patients/:patientId - Update patient
router.put('/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const updates = req.body;

    const result = await query(`
      UPDATE patients 
      SET first_name = COALESCE($1, first_name),
          last_name = COALESCE($2, last_name),
          email = COALESCE($3, email),
          phone = COALESCE($4, phone),
          date_of_birth = COALESCE($5, date_of_birth),
          gender = COALESCE($6, gender),
          status = COALESCE($7, status),
          address = COALESCE($8, address),
          emergency_contact = COALESCE($9, emergency_contact),
          medical_notes = COALESCE($10, medical_notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE patient_id = $11
      RETURNING *
    `, [
      updates.firstName,
      updates.lastName,
      updates.email,
      updates.phone,
      updates.dateOfBirth,
      updates.gender,
      updates.status,
      updates.address,
      updates.emergencyContact,
      updates.medicalNotes,
      patientId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json({
      success: true,
      patient: formatPatient(result.rows[0])
    });

  } catch (error) {
    logger.error('Error updating patient:', error);
    res.status(500).json({ error: 'Failed to update patient' });
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

    const result = await query(`
      UPDATE patients 
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE patient_id = $2
      RETURNING *
    `, [status, patientId]);

    if (result.rows.length === 0) {
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
      patient: formatPatient(result.rows[0])
    });

  } catch (error) {
    logger.error('Error updating patient status:', error);
    res.status(500).json({ error: 'Failed to update patient status' });
  }
});

// DELETE /api/patients/:patientId - Delete patient
router.delete('/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;

    const result = await query(`
      DELETE FROM patients WHERE patient_id = $1 RETURNING patient_id
    `, [patientId]);

    if (result.rows.length === 0) {
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
