/**
 * Database Seed Script
 * Run this to populate MongoDB with sample data
 * Usage: node backend/seed.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Patient = require('./models/Patient');
const HealthData = require('./models/HealthData');
const Alert = require('./models/Alert');
const Device = require('./models/Device');

const samplePatients = [
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
];

const sampleDevices = [
  { deviceId: 'DEV-001', patientId: 'PAT-001', type: 'ESP32', status: 'online', firmware: '1.0.0' },
  { deviceId: 'DEV-002', patientId: 'PAT-002', type: 'ESP32', status: 'online', firmware: '1.0.0' },
  { deviceId: 'DEV-003', patientId: 'PAT-003', type: 'ESP32', status: 'online', firmware: '1.0.0' },
  { deviceId: 'DEV-004', patientId: 'PAT-004', type: 'ESP32', status: 'online', firmware: '1.0.0' },
  { deviceId: 'DEV-005', patientId: 'PAT-005', type: 'ESP32', status: 'offline', firmware: '1.0.0' }
];

const generateHealthData = (patientId, deviceId, days = 7) => {
  const data = [];
  const now = new Date();
  
  for (let i = 0; i < days * 24; i++) {
    const timestamp = new Date(now - (days * 24 - i) * 60 * 60 * 1000);
    
    // Generate realistic health data
    const isSleeping = timestamp.getHours() >= 23 || timestamp.getHours() < 6;
    const baseHeartRate = isSleeping ? 60 : 75;
    const baseTemp = 36.5;
    const baseSpo2 = 97;
    
    data.push({
      patientId,
      deviceId,
      timestamp,
      heartRate: {
        value: baseHeartRate + Math.round(Math.random() * 10 - 5),
        unit: 'bpm',
        quality: 'good'
      },
      temperature: {
        value: baseTemp + Math.round(Math.random() * 10 - 5) / 10,
        unit: '°C',
        method: 'axillary'
      },
      spo2: {
        value: baseSpo2 + Math.round(Math.random() * 4 - 2),
        unit: '%',
        quality: Math.random() > 0.2 ? 'good' : 'fair'
      },
      bloodPressure: {
        systolic: 115 + Math.round(Math.random() * 20 - 10),
        diastolic: 75 + Math.round(Math.random() * 15 - 7),
        unit: 'mmHg'
      },
      status: 'normal'
    });
  }
  
  return data;
};

async function seed() {
  try {
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/iot_health_monitor';
    
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');
    
    // Clear existing data
    console.log('Clearing existing data...');
    await Patient.deleteMany({});
    await HealthData.deleteMany({});
    await Alert.deleteMany({});
    await Device.deleteMany({});
    
    // Insert sample patients
    console.log('Inserting sample patients...');
    await Patient.insertMany(samplePatients);
    console.log(`Inserted ${samplePatients.length} patients`);
    
    // Insert sample devices
    console.log('Inserting sample devices...');
    await Device.insertMany(sampleDevices);
    console.log(`Inserted ${sampleDevices.length} devices`);
    
    // Generate health data for each patient
    console.log('Generating health data...');
    for (const patient of samplePatients) {
      const device = sampleDevices.find(d => d.patientId === patient.patientId);
      const healthData = generateHealthData(patient.patientId, device.deviceId, 7);
      await HealthData.insertMany(healthData);
      console.log(`Generated ${healthData.length} health records for ${patient.patientId}`);
    }
    
    // Generate some alerts
    console.log('Generating alerts...');
    const alerts = [
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
    ];
    await Alert.insertMany(alerts);
    console.log(`Inserted ${alerts.length} alerts`);
    
    console.log('\n✅ Database seeded successfully!');
    console.log('\nSample Patients:');
    samplePatients.forEach(p => console.log(`  - ${p.patientId}: ${p.firstName} ${p.lastName}`));
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seed();
