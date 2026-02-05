/**
 * Device Model
 * Stores IoT device information and configuration
 */

const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['ESP32', 'Arduino', 'RaspberryPi', 'custom'],
    default: 'ESP32'
  },
  patientId: {
    type: String,
    index: true
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'maintenance', 'retired'],
    default: 'offline',
    index: true
  },
  firmware: {
    version: String,
    lastUpdated: Date,
    updateAvailable: Boolean
  },
  sensors: [{
    type: {
      type: String,
      enum: ['heartRate', 'temperature', 'spo2', 'bloodPressure', 'ecg', 'respiration', 'accelerometer']
    },
    model: String,
    enabled: Boolean,
    calibration: {
      offset: Number,
      scale: Number,
      lastCalibrated: Date
    }
  }],
  connectivity: {
    network: {
      type: String,
      enum: ['wifi', 'gsm', 'lora', 'bluetooth'],
      default: 'wifi'
    },
    wifi: {
      ssid: String,
      signalStrength: Number,
      ip: String
    },
    gsm: {
      imei: String,
      signalStrength: Number,
      operator: String
    }
  },
  power: {
    source: {
      type: String,
      enum: ['battery', ' mains', 'solar'],
      default: 'battery'
    },
    batteryLevel: {
      type: Number,
      min: 0,
      max: 100
    },
    batteryHealth: {
      type: Number,
      min: 0,
      max: 100
    },
    lastCharged: Date,
    estimatedBatteryLife: Number // in hours
  },
  location: {
    lat: Number,
    lng: Number,
    address: String,
    lastUpdated: Date
  },
  settings: {
    samplingRate: {
      type: Number,
      default: 1 // samples per second
    },
    dataTransmissionInterval: {
      type: Number,
      default: 5 // seconds
    },
    alertThreshold: {
      heartRate: { min: Number, max: Number },
      temperature: { min: Number, max: Number },
      spo2: { min: Number }
    },
    storage: {
      enabled: Boolean,
      maxEntries: Number
    }
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  lastData: {
    timestamp: Date,
    heartRate: Number,
    temperature: Number,
    spo2: Number
  },
  maintenance: {
    lastMaintenance: Date,
    nextMaintenance: Date,
    maintenanceHistory: [{
      date: Date,
      type: String,
      description: String,
      performedBy: String
    }]
  },
  metadata: {
    manufacturer: String,
    model: String,
    serialNumber: String,
    purchaseDate: Date,
    warrantyExpiry: Date,
    notes: String
  }
}, {
  timestamps: true
});

// Indexes
deviceSchema.index({ patientId: 1, status: 1 });
deviceSchema.index({ status: 1, lastSeen: -1 });
deviceSchema.index({ 'sensors.type': 1 });

// Method to update device status
deviceSchema.methods.updateStatus = function(status) {
  this.status = status;
  this.lastSeen = new Date();
  return this.save();
};

// Method to update heartbeat
deviceSchema.methods.heartbeat = function() {
  this.status = 'online';
  this.lastSeen = new Date();
  return this.save();
};

// Method to check if device is online
deviceSchema.methods.isOnline = function() {
  const offlineThreshold = 5 * 60 * 1000; // 5 minutes
  return this.status === 'online' && 
         (new Date() - this.lastSeen) < offlineThreshold;
};

// Method to update battery level
deviceSchema.methods.updateBattery = function(level) {
  this.power.batteryLevel = level;
  this.lastSeen = new Date();
  
  // Add alert if battery is low
  if (level < 20 && this.power.batteryLevel >= 20) {
    return this.sendLowBatteryAlert();
  }
  
  return this.save();
};

// Method to add data reading
deviceSchema.methods.addReading = function(data) {
  this.lastData = {
    timestamp: new Date(),
    ...data
  };
  this.lastSeen = new Date();
  this.status = 'online';
  return this.save();
};

// Static method to find online devices
deviceSchema.statics.findOnlineDevices = function() {
  const offlineThreshold = 5 * 60 * 1000;
  const threshold = new Date(Date.now() - offlineThreshold);
  return this.find({
    status: 'online',
    lastSeen: { $gte: threshold }
  });
};

// Static method to get devices needing maintenance
deviceSchema.statics.getMaintenanceDue = function() {
  return this.find({
    $or: [
      { 'maintenance.nextMaintenance': { $lte: new Date() } },
      { 'power.batteryHealth': { $lt: 70 } }
    ]
  });
};

module.exports = mongoose.model('Device', deviceSchema);
