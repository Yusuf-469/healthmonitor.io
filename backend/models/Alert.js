/**
 * Alert Model
 * Stores health alerts and notifications
 */

const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  alertId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  patientId: {
    type: String,
    required: true,
    index: true
  },
  deviceId: {
    type: String,
    index: true
  },
  type: {
    type: String,
    enum: [
      'heartRate',      // Abnormal heart rate
      'temperature',    // Abnormal body temperature
      'spo2',           // Low blood oxygen
      'bloodPressure',  // Abnormal blood pressure
      'ecg',            // ECG abnormalities
      'respiration',    // Breathing issues
      'deviceOffline',  // Device disconnected
      'lowBattery',     // Device battery low
      'fallDetection',  // Patient fall detected
      'deviceError',    // Sensor malfunction
      'prediction'      // AI predicted risk
    ],
    required: true,
    index: true
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'critical', 'emergency'],
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'acknowledged', 'resolved', 'escalated'],
    default: 'active',
    index: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  data: {
    value: Number,
    threshold: Number,
    unit: String,
    readings: [{
      timestamp: Date,
      value: Number
    }]
  },
  triggeredBy: {
    ruleId: String,
    thresholdId: String,
    predictionId: String
  },
  notifications: [{
    channel: {
      type: String,
      enum: ['email', 'sms', 'push', 'call', 'dashboard']
    },
    recipient: String,
    sentAt: Date,
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'failed']
    },
    messageId: String
  }],
  assignedTo: {
    userId: String,
    name: String,
    assignedAt: Date
  },
  resolution: {
    resolvedBy: String,
    resolvedAt: Date,
    method: String,
    notes: String
  },
  escalation: {
    level: Number,
    escalatedAt: Date,
    escalatedTo: String,
    reason: String
  },
  metadata: {
    patientAge: Number,
    patientConditions: [String],
    deviceType: String,
    location: String,
    tags: [String]
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  acknowledgedAt: Date,
  resolvedAt: Date,
  expiresAt: Date
}, {
  timestamps: true
});

// Compound indexes
alertSchema.index({ patientId: 1, status: 1, createdAt: -1 });
alertSchema.index({ severity: 1, status: 1, createdAt: -1 });
alertSchema.index({ type: 1, createdAt: -1 });

// TTL index to archive resolved alerts after 30 days
// alertSchema.index({ resolvedAt: 1 }, { expireAfterSeconds: 2592000 });

// Pre-save middleware to generate alert ID
alertSchema.pre('save', function(next) {
  if (!this.alertId) {
    this.alertId = `ALT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }
  next();
});

// Method to acknowledge alert
alertSchema.methods.acknowledge = function(userId) {
  this.status = 'acknowledged';
  this.acknowledgedAt = new Date();
  this.assignedTo = {
    userId,
    assignedAt: new Date()
  };
  return this.save();
};

// Method to resolve alert
alertSchema.methods.resolve = function(userId, method, notes = '') {
  this.status = 'resolved';
  this.resolvedAt = new Date();
  this.resolution = {
    resolvedBy: userId,
    resolvedAt: new Date(),
    method,
    notes
  };
  return this.save();
};

// Method to escalate alert
alertSchema.methods.escalate = function(level, escalatedTo, reason) {
  this.status = 'escalated';
  this.escalation = {
    level,
    escalatedAt: new Date(),
    escalatedTo,
    reason
  };
  this.severity = 'emergency';
  return this.save();
};

// Static method to get active critical alerts
alertSchema.statics.getActiveCritical = function() {
  return this.find({
    status: 'active',
    severity: { $in: ['critical', 'emergency'] }
  }).sort({ createdAt: -1 });
};

// Static method to get alerts by patient
alertSchema.statics.getPatientAlerts = function(patientId, options = {}) {
  const query = { patientId };
  if (options.status) query.status = options.status;
  if (options.severity) query.severity = options.severity;
  if (options.type) query.type = options.type;
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 100);
};

// Static method to get alert statistics
alertSchema.statics.getStatistics = async function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          type: '$type',
          severity: '$severity'
        },
        count: { $sum: 1 },
        avgResolutionTime: {
          $avg: {
            $cond: [
              { $eq: ['$status', 'resolved'] },
              { $subtract: ['$resolvedAt', '$createdAt'] },
              null
            ]
          }
        }
      }
    },
    {
      $group: {
        _id: '$_id.type',
        severities: {
          $push: {
            severity: '$_id.severity',
            count: '$count'
          }
        },
        totalCount: { $sum: '$count' },
        avgResolutionTime: { $avg: '$avgResolutionTime' }
      }
    }
  ]);
};

module.exports = mongoose.model('Alert', alertSchema);
