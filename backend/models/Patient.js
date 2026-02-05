/**
 * Patient Model
 * Stores patient information and configuration
 */

const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  patientId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: true
  },
  dateOfBirth: {
    type: Date,
    required: true
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  },
  medicalHistory: [{
    condition: String,
    diagnosedDate: Date,
    status: {
      type: String,
      enum: ['active', 'resolved', 'chronic']
    }
  }],
  medications: [{
    name: String,
    dosage: String,
    frequency: String,
    startDate: Date
  }],
  assignedDevices: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device'
  }],
  alertSettings: {
    heartRate: {
      min: { type: Number, default: 60 },
      max: { type: Number, default: 100 }
    },
    temperature: {
      min: { type: Number, default: 36.1 },
      max: { type: Number, default: 37.8 }
    },
    spo2: {
      min: { type: Number, default: 95 }
    },
    bloodPressure: {
      systolicMax: { type: Number, default: 140 },
      diastolicMax: { type: Number, default: 90 }
    },
    alertMethods: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    }
  },
  caregivers: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    permissions: [{
      type: String,
      enum: ['view', 'alert', 'manage']
    }]
  }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'critical', 'discharged'],
    default: 'active'
  },
  lastReading: {
    timestamp: Date,
    heartRate: Number,
    temperature: Number,
    spo2: Number,
    bloodPressure: {
      systolic: Number,
      diastolic: Number
    }
  }
}, {
  timestamps: true
});

// Virtual for full name
patientSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for age
patientSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

// Index for search
patientSchema.index({ firstName: 'text', lastName: 'text', patientId: 'text' });

// Method to check if reading is abnormal
patientSchema.methods.isAbnormalReading = function(reading) {
  const { heartRate, temperature, spo2, bloodPressure } = this.alertSettings;
  
  const alerts = [];
  
  if (reading.heartRate < heartRate.min || reading.heartRate > heartRate.max) {
    alerts.push({
      type: 'heartRate',
      severity: 'critical',
      message: `Abnormal heart rate: ${reading.heartRate} bpm (normal: ${heartRate.min}-${heartRate.max})`
    });
  }
  
  if (reading.temperature < temperature.min || reading.temperature > temperature.max) {
    alerts.push({
      type: 'temperature',
      severity: reading.temperature > 38 ? 'critical' : 'warning',
      message: `Abnormal temperature: ${reading.temperature}°C (normal: ${temperature.min}-${temperature.max})`
    });
  }
  
  if (reading.spo2 < spo2.min) {
    alerts.push({
      type: 'spo2',
      severity: 'critical',
      message: `Low blood oxygen: ${reading.spo2}% (minimum: ${spo2.min}%)`
    });
  }
  
  if (bloodPressure) {
    if (bloodPressure.systolic > bloodPressure.systolicMax || 
        bloodPressure.diastolic > bloodPressure.diastolicMax) {
      alerts.push({
        type: 'bloodPressure',
        severity: 'critical',
        message: `High blood pressure: ${bloodPressure.systolic}/${bloodPressure.diastolic} mmHg`
      });
    }
  }
  
  return alerts;
};

// Static method to find active patients
patientSchema.statics.findActivePatients = function() {
  return this.find({ status: 'active' });
};

module.exports = mongoose.model('Patient', patientSchema);
