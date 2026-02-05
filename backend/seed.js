/**
 * Database Seeding Script
 * Seeds demo user and sample data for PostgreSQL
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query, connectDB } = require('./database');

const logger = require('./utils/logger');

const seedDatabase = async () => {
  try {
    // Connect to database
    const connected = await connectDB();
    if (!connected) {
      logger.error('Failed to connect to database');
      process.exit(1);
    }

    logger.info('Starting database seeding...');

    // Seed demo user
    await seedDemoUser();

    // Seed sample patients
    await seedPatients();

    // Seed sample devices
    await seedDevices();

    // Seed sample health data
    await seedHealthData();

    // Seed sample alerts
    await seedAlerts();

    logger.info('Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Seeding error:', error);
    process.exit(1);
  }
};

const seedDemoUser = async () => {
  try {
    const result = await query('SELECT id FROM users WHERE email = $1', ['demo@healthmonitor.com']);
    
    if (result.rows.length === 0) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('demo1234', salt);
      
      await query(`
        INSERT INTO users (email, password, first_name, last_name, role, status, is_demo)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, ['demo@healthmonitor.com', hashedPassword, 'Demo', 'Admin', 'admin', 'active', true]);
      
      logger.info('Demo user created: demo@healthmonitor.com / demo1234');
    } else {
      logger.info('Demo user already exists');
    }
  } catch (error) {
    logger.error('Error seeding demo user:', error);
  }
};

const seedPatients = async () => {
  const patients = [
    {
      patient_id: 'PAT-001',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      date_of_birth: '1985-03-15',
      gender: 'male',
      status: 'active'
    },
    {
      patient_id: 'PAT-002',
      first_name: 'Jane',
      last_name: 'Smith',
      email: 'jane.smith@example.com',
      phone: '+1234567891',
      date_of_birth: '1990-07-22',
      gender: 'female',
      status: 'critical'
    },
    {
      patient_id: 'PAT-003',
      first_name: 'Robert',
      last_name: 'Johnson',
      email: 'robert.johnson@example.com',
      phone: '+1234567892',
      date_of_birth: '1978-11-30',
      gender: 'male',
      status: 'active'
    },
    {
      patient_id: 'PAT-004',
      first_name: 'Emily',
      last_name: 'Davis',
      email: 'emily.davis@example.com',
      phone: '+1234567893',
      date_of_birth: '1995-05-18',
      gender: 'female',
      status: 'active'
    },
    {
      patient_id: 'PAT-005',
      first_name: 'Michael',
      last_name: 'Wilson',
      email: 'michael.wilson@example.com',
      phone: '+1234567894',
      date_of_birth: '1982-09-08',
      gender: 'male',
      status: 'active'
    }
  ];

  for (const patient of patients) {
    try {
      const result = await query('SELECT id FROM patients WHERE patient_id = $1', [patient.patient_id]);
      
      if (result.rows.length === 0) {
        await query(`
          INSERT INTO patients (patient_id, first_name, last_name, email, phone, date_of_birth, gender, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [patient.patient_id, patient.first_name, patient.last_name, patient.email, patient.phone, patient.date_of_birth, patient.gender, patient.status]);
        
        logger.info(`Patient created: ${patient.first_name} ${patient.last_name}`);
      }
    } catch (error) {
      logger.error(`Error seeding patient ${patient.patient_id}:`, error);
    }
  }
};

const seedDevices = async () => {
  const devices = [
    { device_id: 'DEV-001', patient_id: 'PAT-001', type: 'ESP32', status: 'online', firmware: '1.0.0' },
    { device_id: 'DEV-002', patient_id: 'PAT-002', type: 'ESP32', status: 'online', firmware: '1.0.0' },
    { device_id: 'DEV-003', patient_id: 'PAT-003', type: 'ESP32', status: 'online', firmware: '1.0.0' },
    { device_id: 'DEV-004', patient_id: 'PAT-004', type: 'ESP32', status: 'online', firmware: '1.0.0' },
    { device_id: 'DEV-005', patient_id: 'PAT-005', type: 'ESP32', status: 'offline', firmware: '1.0.0' }
  ];

  for (const device of devices) {
    try {
      const result = await query('SELECT id FROM devices WHERE device_id = $1', [device.device_id]);
      
      if (result.rows.length === 0) {
        await query(`
          INSERT INTO devices (device_id, patient_id, type, status, firmware)
          VALUES ($1, $2, $3, $4, $5)
        `, [device.device_id, device.patient_id, device.type, device.status, device.firmware]);
        
        logger.info(`Device created: ${device.device_id}`);
      }
    } catch (error) {
      logger.error(`Error seeding device ${device.device_id}:`, error);
    }
  }
};

const seedHealthData = async () => {
  const patients = ['PAT-001', 'PAT-002', 'PAT-003', 'PAT-004', 'PAT-005'];
  const now = new Date();
  
  for (const patientId of patients) {
    try {
      // Check if health data exists
      const result = await query('SELECT id FROM health_data WHERE patient_id = $1 LIMIT 1', [patientId]);
      
      if (result.rows.length === 0) {
        // Generate 7 days of health data (24 readings per day)
        for (let day = 0; day < 7; day++) {
          for (let hour = 0; hour < 24; hour += 2) {
            const timestamp = new Date(now - (7 - day) * 24 * 60 * 60 * 1000 + hour * 60 * 60 * 1000);
            const isSleeping = hour >= 23 || hour < 6;
            const baseHeartRate = isSleeping ? 60 : 75;
            
            // Adjust for patient-specific conditions
            let heartRate = baseHeartRate + Math.round(Math.random() * 10 - 5);
            let temperature = 36.5 + Math.round(Math.random() * 10 - 5) / 10;
            let spo2 = 97 + Math.round(Math.random() * 4 - 2);
            
            // PAT-002 is critical
            if (patientId === 'PAT-002') {
              heartRate = 95 + Math.round(Math.random() * 15);
              temperature = 37.5 + Math.round(Math.random() * 15) / 10;
              spo2 = 92 + Math.round(Math.random() * 4);
            }

            await query(`
              INSERT INTO health_data (patient_id, device_id, heart_rate, temperature, spo2, blood_pressure_systolic, blood_pressure_diastolic, status, timestamp)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
              patientId,
              `DEV-${patientId.split('-')[1].padStart(3, '0')}`,
              heartRate,
              temperature,
              spo2,
              115 + Math.round(Math.random() * 20 - 10),
              75 + Math.round(Math.random() * 15 - 7),
              patientId === 'PAT-002' ? 'warning' : 'normal',
              timestamp
            ]);
          }
        }
        
        logger.info(`Health data generated for ${patientId}`);
      }
    } catch (error) {
      logger.error(`Error seeding health data for ${patientId}:`, error);
    }
  }
};

const seedAlerts = async () => {
  const alerts = [
    {
      alert_id: 'ALT-001',
      patient_id: 'PAT-002',
      device_id: 'DEV-002',
      type: 'heartRate',
      severity: 'critical',
      title: 'High Heart Rate Detected',
      message: 'Patient PAT-002 heart rate exceeded 100 bpm',
      status: 'active'
    },
    {
      alert_id: 'ALT-002',
      patient_id: 'PAT-002',
      device_id: 'DEV-002',
      type: 'temperature',
      severity: 'warning',
      title: 'Elevated Temperature',
      message: 'Patient PAT-002 temperature is 38.2°C',
      status: 'active'
    },
    {
      alert_id: 'ALT-003',
      patient_id: 'PAT-005',
      device_id: 'DEV-005',
      type: 'device',
      severity: 'warning',
      title: 'Device Offline',
      message: 'Device DEV-005 has not sent data in 30 minutes',
      status: 'active'
    }
  ];

  for (const alert of alerts) {
    try {
      const result = await query('SELECT id FROM alerts WHERE alert_id = $1', [alert.alert_id]);
      
      if (result.rows.length === 0) {
        await query(`
          INSERT INTO alerts (alert_id, patient_id, device_id, type, severity, title, message, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [alert.alert_id, alert.patient_id, alert.device_id, alert.type, alert.severity, alert.title, alert.message, alert.status]);
        
        logger.info(`Alert created: ${alert.alert_id}`);
      }
    } catch (error) {
      logger.error(`Error seeding alert ${alert.alert_id}:`, error);
    }
  }
};

// Run if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase, seedDemoUser, seedPatients, seedDevices, seedHealthData, seedAlerts };
