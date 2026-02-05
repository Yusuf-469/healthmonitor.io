/**
 * HealthData Model
 * Stores continuous health monitoring data from sensors
 */

const mongoose = require('mongoose');

const healthDataSchema = new mongoose.Schema({
  patientId: {
    type: String,
    required: true,
    index: true
  },
  deviceId: {
    type: String,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  heartRate: {
    value: {
      type: Number,
      required: true,
      min: 0,
      max: 250
    },
    unit: {
      type: String,
      default: 'bpm'
    },
    quality: {
      type: String,
      enum: ['good', 'fair', 'poor'],
      default: 'good'
    }
  },
  temperature: {
    value: {
      type: Number,
      required: true,
      min: 30,
      max: 45
    },
    unit: {
      type: String,
      default: '°C'
    },
    method: {
      type: String,
      enum: ['oral', 'axillary', 'tympanic', 'rectal'],
      default: 'axillary'
    }
  },
  spo2: {
    value: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    unit: {
      type: String,
      default: '%'
    },
    quality: {
      type: String,
      enum: ['good', 'fair', 'poor'],
      default: 'good'
    }
  },
  bloodPressure: {
    systolic: {
      type: Number,
      min: 60,
      max: 250
    },
    diastolic: {
      type: Number,
      min: 40,
      max: 150
    },
    unit: {
      type: String,
      default: 'mmHg'
    },
    method: {
      type: String,
      enum: ['oscillometric', 'auscultatory'],
      default: 'oscillometric'
    }
  },
  ecg: {
    leads: [{
      lead: String,
      data: [Number],
      samplingRate: Number
    }],
    heartRate: Number,
    rrInterval: Number,
    prInterval: Number,
    qtInterval: Number,
    qrsDuration: Number
  },
  respiration: {
    rate: {
      type: Number,
      min: 0,
      max: 60
    },
    unit: {
      type: String,
      default: 'breaths/min'
    }
  },
  device: {
    batteryLevel: {
      type: Number,
      min: 0,
      max: 100
    },
    signalStrength: Number,
    firmware: String
  },
  status: {
    type: String,
    enum: ['normal', 'warning', 'critical', 'error'],
    default: 'normal'
  },
  alerts: [{
    type: {
      type: String,
      enum: ['heartRate', 'temperature', 'spo2', 'bloodPressure', 'ecg']
    },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical']
    },
    message: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  metadata: {
    environment: {
      temperature: Number,
      humidity: Number
    },
    patientActivity: {
      type: String,
      enum: ['resting', 'walking', 'exercise', 'sleeping'],
      default: 'resting'
    },
    notes: String
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
healthDataSchema.index({ patientId: 1, timestamp: -1 });
healthDataSchema.index({ patientId: 1, deviceId: 1, timestamp: -1 });
healthDataSchema.index({ status: 1, timestamp: -1 });

// TTL index to automatically delete old data (optional)
// healthDataSchema.index({ timestamp: 1 }, { expireAfterSeconds: 31536000 }); // 1 year

// Virtual for pulse pressure
healthDataSchema.virtual('pulsePressure').get(function() {
  if (this.bloodPressure && this.bloodPressure.systolic && this.bloodPressure.diastolic) {
    return this.bloodPressure.systolic - this.bloodPressure.diastolic;
  }
  return null;
});

// Method to assess overall status
healthDataSchema.methods.assessStatus = function(thresholds = {}) {
  const defaultThresholds = {
    heartRate: { min: 60, max: 100, criticalMax: 120, criticalMin: 40 },
    temperature: { min: 36.1, max: 37.8, criticalMax: 38.5, criticalMin: 35 },
    spo2: { min: 95, criticalMin: 90 },
    bloodPressure: { systolicMax: 140, diastolicMax: 90, systolicCritical: 180, diastolicCritical: 120 }
  };
  
  const t = { ...defaultThresholds, ...thresholds };
  let status = 'normal';
  const alerts = [];
  
  // Check heart rate
  if (this.heartRate.value > t.heartRate.criticalMax || this.heartRate.value < t.heartRate.criticalMin) {
    status = 'critical';
    alerts.push({ type: 'heartRate', severity: 'critical', message: 'Critical heart rate detected' });
  } else if (this.heartRate.value > t.heartRate.max || this.heartRate.value < t.heartRate.min) {
    if (status !== 'critical') status = 'warning';
    alerts.push({ type: 'heartRate', severity: 'warning', message: 'Abnormal heart rate detected' });
  }
  
  // Check temperature
  if (this.temperature.value > t.temperature.criticalMax || this.temperature.value < t.temperature.criticalMin) {
    status = 'critical';
    alerts.push({ type: 'temperature', severity: 'critical', message: 'Critical temperature detected' });
  } else if (this.temperature.value > t.temperature.max || this.temperature.value < t.temperature.min) {
    if (status !== 'critical') status = 'warning';
    alerts.push({ type: 'temperature', severity: 'warning', message: 'Abnormal temperature detected' });
  }
  
  // Check SpO2
  if (this.spo2.value < t.spo2.criticalMin) {
    status = 'critical';
    alerts.push({ type: 'spo2', severity: 'critical', message: 'Critical oxygen saturation detected' });
  } else if (this.spo2.value < t.spo2.min) {
    if (status !== 'critical') status = 'warning';
    alerts.push({ type: 'spo2', severity: 'warning', message: 'Low oxygen saturation detected' });
  }
  
  // Check blood pressure
  if (this.bloodPressure) {
    if (this.bloodPressure.systolic > t.bloodPressure.systolicCritical || 
        this.bloodPressure.diastolic > t.bloodPressure.diastolicCritical) {
      status = 'critical';
      alerts.push({ type: 'bloodPressure', severity: 'critical', message: 'Critical blood pressure detected' });
    } else if (this.bloodPressure.systolic > t.bloodPressure.systolicMax || 
               this.bloodPressure.diastolic > t.bloodPressure.diastolicMax) {
      if (status !== 'critical') status = 'warning';
      alerts.push({ type: 'bloodPressure', severity: 'warning', message: 'High blood pressure detected' });
    }
  }
  
  this.status = status;
  this.alerts = alerts;
  return { status, alerts };
};

// Static method for time series aggregation
healthDataSchema.statics.getTimeSeries = async function(patientId, startTime, endTime, interval = '1h') {
  const groupByInterval = {
    day: '%Y-%m-%d',
    hour: '%Y-%m-%d %H:00',
    minute: '%Y-%m-%d %H:%M'
  };
  
  return this.aggregate([
    {
      $match: {
        patientId,
        timestamp: { $gte: startTime, $lte: endTime }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: groupByInterval[interval] || '%Y-%m-%d %H:%M', date: '$timestamp' }
        },
        avgHeartRate: { $avg: '$heartRate.value' },
        avgTemperature: { $avg: '$temperature.value' },
        avgSpo2: { $avg: '$spo2.value' },
        avgSystolic: { $avg: '$bloodPressure.systolic' },
        avgDiastolic: { $avg: '$bloodPressure.diastolic' },
        minHeartRate: { $min: '$heartRate.value' },
        maxHeartRate: { $max: '$heartRate.value' },
        readings: { $sum: 1 },
        firstTimestamp: { $first: '$timestamp' }
      }
    },
    { $sort: { firstTimestamp: 1 } }
  ]);
};

module.exports = mongoose.model('HealthData', healthDataSchema);
