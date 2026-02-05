/**
 * Sample Data for Auto-Seeding
 */

const bcrypt = require('bcryptjs');

const seedUsers = async () => {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('demo1234', salt);
  
  return [
    {
      email: 'demo@healthmonitor.com',
      password: hashedPassword,
      firstName: 'Demo',
      lastName: 'Admin',
      role: 'admin',
      status: 'active',
      isDemo: true
    }
  ];
};

module.exports = {
  seedUsers,
  patients: [
    {
      patientId: 'PAT-001',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      dateOfBirth: new Date('1985-03-15'),
      gender: 'male',
      status: 'active',
      lastReading: {
        timestamp: new Date(),
        heartRate: 72,
        temperature: 36.8,
        spo2: 98,
        bloodPressure: { systolic: 120, diastolic: 80 }
      },
      alertSettings: {
        heartRate: { min: 60, max: 100 },
        temperature: { min: 36.1, max: 37.8 },
        spo2: { min: 95 },
        bloodPressure: { systolicMax: 140, diastolicMax: 90 }
      }
    },
    {
      patientId: 'PAT-002',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      phone: '+1234567891',
      dateOfBirth: new Date('1990-07-22'),
      gender: 'female',
      status: 'critical',
      lastReading: {
        timestamp: new Date(),
        heartRate: 105,
        temperature: 38.2,
        spo2: 94,
        bloodPressure: { systolic: 145, diastolic: 92 }
      },
      alertSettings: {
        heartRate: { min: 60, max: 100 },
        temperature: { min: 36.1, max: 37.8 },
        spo2: { min: 95 },
        bloodPressure: { systolicMax: 140, diastolicMax: 90 }
      }
    },
    {
      patientId: 'PAT-003',
      firstName: 'Robert',
      lastName: 'Johnson',
      email: 'robert.johnson@example.com',
      phone: '+1234567892',
      dateOfBirth: new Date('1978-11-30'),
      gender: 'male',
      status: 'active',
      lastReading: {
        timestamp: new Date(),
        heartRate: 68,
        temperature: 36.5,
        spo2: 99,
        bloodPressure: { systolic: 118, diastolic: 78 }
      },
      alertSettings: {
        heartRate: { min: 60, max: 100 },
        temperature: { min: 36.1, max: 37.8 },
        spo2: { min: 95 },
        bloodPressure: { systolicMax: 140, diastolicMax: 90 }
      }
    },
    {
      patientId: 'PAT-004',
      firstName: 'Emily',
      lastName: 'Davis',
      email: 'emily.davis@example.com',
      phone: '+1234567893',
      dateOfBirth: new Date('1995-05-18'),
      gender: 'female',
      status: 'active',
      lastReading: {
        timestamp: new Date(),
        heartRate: 75,
        temperature: 36.9,
        spo2: 97,
        bloodPressure: { systolic: 122, diastolic: 82 }
      },
      alertSettings: {
        heartRate: { min: 60, max: 100 },
        temperature: { min: 36.1, max: 37.8 },
        spo2: { min: 95 },
        bloodPressure: { systolicMax: 140, diastolicMax: 90 }
      }
    },
    {
      patientId: 'PAT-005',
      firstName: 'Michael',
      lastName: 'Wilson',
      email: 'michael.wilson@example.com',
      phone: '+1234567894',
      dateOfBirth: new Date('1982-09-08'),
      gender: 'male',
      status: 'active',
      lastReading: {
        timestamp: new Date(),
        heartRate: 82,
        temperature: 36.6,
        spo2: 98,
        bloodPressure: { systolic: 128, diastolic: 85 }
      },
      alertSettings: {
        heartRate: { min: 60, max: 100 },
        temperature: { min: 36.1, max: 37.8 },
        spo2: { min: 95 },
        bloodPressure: { systolicMax: 140, diastolicMax: 90 }
      }
    }
  ],
  devices: [
    { deviceId: 'DEV-001', patientId: 'PAT-001', type: 'ESP32', status: 'online', firmware: '1.0.0' },
    { deviceId: 'DEV-002', patientId: 'PAT-002', type: 'ESP32', status: 'online', firmware: '1.0.0' },
    { deviceId: 'DEV-003', patientId: 'PAT-003', type: 'ESP32', status: 'online', firmware: '1.0.0' },
    { deviceId: 'DEV-004', patientId: 'PAT-004', type: 'ESP32', status: 'online', firmware: '1.0.0' },
    { deviceId: 'DEV-005', patientId: 'PAT-005', type: 'ESP32', status: 'offline', firmware: '1.0.0' }
  ],
  alerts: [
    {
      alertId: 'ALT-001',
      patientId: 'PAT-002',
      deviceId: 'DEV-002',
      type: 'heartRate',
      severity: 'critical',
      title: 'High Heart Rate Detected',
      message: 'Patient PAT-002 heart rate exceeded 100 bpm',
      status: 'active',
      createdAt: new Date(Date.now() - 300000)
    },
    {
      alertId: 'ALT-002',
      patientId: 'PAT-002',
      deviceId: 'DEV-002',
      type: 'temperature',
      severity: 'warning',
      title: 'Elevated Temperature',
      message: 'Patient PAT-002 temperature is 38.2°C',
      status: 'active',
      createdAt: new Date(Date.now() - 600000)
    },
    {
      alertId: 'ALT-003',
      patientId: 'PAT-005',
      deviceId: 'DEV-005',
      type: 'device',
      severity: 'warning',
      title: 'Device Offline',
      message: 'Device DEV-005 has not sent data in 30 minutes',
      status: 'active',
      createdAt: new Date(Date.now() - 1800000)
    }
  ]
};
