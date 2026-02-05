# IoT-Based Intelligent Health Monitoring and Alert System

A comprehensive real-time health monitoring system using IoT sensors, cloud connectivity, and AI-based health risk prediction.

## 🌟 Features

### Core Functionality
- **Real-time Health Monitoring**: Continuous tracking of heart rate, body temperature, blood oxygen (SpO2), and blood pressure
- **Instant Alerts**: Real-time notifications via email, SMS, and push notifications for abnormal readings
- **AI-Powered Predictions**: Health risk assessment using machine learning algorithms
- **Interactive Dashboard**: Web-based monitoring dashboard with live data visualization

### Technical Features
- RESTful API with Express.js backend
- MongoDB database for flexible data storage
- Socket.IO for real-time bidirectional communication
- Chart.js for interactive data visualization
- Firebase integration for cloud messaging
- ESP32 hardware integration for sensor data collection

## 🏗️ System Architecture

```
Sensors (MAX30102, DS18B20)
        ↓
    ESP32 Microcontroller
        ↓
    WiFi/Cloud Server
        ↓
    Node.js Backend
        ↓
    MongoDB + Firebase
        ↓
    Frontend Dashboard
```

## 📁 Project Structure

```
medical-iot/
├── backend/
│   ├── models/
│   │   ├── Patient.js       # Patient data model
│   │   ├── HealthData.js     # Health readings model
│   │   ├── Alert.js          # Alert management model
│   │   └── Device.js         # IoT device model
│   ├── routes/
│   │   ├── healthData.js     # Health data API endpoints
│   │   ├── alerts.js         # Alert management endpoints
│   │   ├── patients.js       # Patient management endpoints
│   │   └── predictions.js    # AI prediction endpoints
│   ├── services/
│   │   ├── predictionService.js    # ML prediction logic
│   │   └── notificationService.js  # Notification handling
│   ├── middleware/
│   │   └── errorHandler.js   # Error handling middleware
│   ├── utils/
│   │   └── logger.js         # Logging utility
│   └── server.js             # Main server entry point
├── frontend/
│   ├── index.html            # Main dashboard HTML
│   ├── css/
│   │   └── styles.css        # Dashboard styles
│   └── js/
│       ├── api.js            # API service
│       ├── charts.js         # Chart.js configuration
│       └── app.js            # Main application logic
├── hardware/
│   └── esp32_health_monitor/
│       └── esp32_health_monitor.ino  # ESP32 firmware
├── .env.example              # Environment configuration template
├── package.json              # Node.js dependencies
└── README.md                 # This file
```

## 🚀 Getting Started

### Prerequisites

- Node.js v18+ and npm
- MongoDB (local or Atlas)
- ESP32 development board
- Health sensors (MAX30102, DS18B20)
- Arduino IDE (for hardware programming)

### Backend Setup

1. Navigate to the project directory:
   ```bash
   cd medical-iot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file:
   ```bash
   cp .env.example .env
   ```

4. Configure your `.env` file with your settings:
   ```env
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/iot_health_monitor
   JWT_SECRET=your-secret-key
   ```

5. Start the server:
   ```bash
   npm run dev
   ```

### Frontend Setup

1. Open `frontend/index.html` in a web browser, or serve it with a static server:
   ```bash
   npx serve frontend
   ```

### Hardware Setup

1. Install required Arduino libraries:
   - WiFi.h (built-in)
   - HTTPClient
   - Wire.h (built-in)
   - MAX30105 Library (SparkFun)
   - OneWire Library
   - DallasTemperature Library

2. Open `hardware/esp32_health_monitor/esp32_health_monitor.ino` in Arduino IDE

3. Select ESP32 board and upload the code

4. Configure WiFi credentials in the code:
   ```cpp
   const char* WIFI_SSID = "your_wifi_ssid";
   const char* WIFI_PASSWORD = "your_wifi_password";
   const char* SERVER_URL = "http://your-server-ip:5000/api/health-data";
   ```

## 📡 API Endpoints

### Health Data
- `POST /api/health-data` - Submit health data from device
- `GET /api/health-data/:patientId` - Get patient health data
- `GET /api/health-data/:patientId/latest` - Get latest reading
- `GET /api/health-data/:patientId/summary` - Get aggregated summary

### Alerts
- `GET /api/alerts` - Get all alerts
- `GET /api/alerts/active` - Get active critical alerts
- `PUT /api/alerts/:alertId/acknowledge` - Acknowledge alert
- `PUT /api/alerts/:alertId/resolve` - Resolve alert

### Patients
- `GET /api/patients` - Get all patients
- `POST /api/patients` - Create new patient
- `GET /api/patients/:patientId` - Get patient details
- `PUT /api/patients/:patientId` - Update patient

### Predictions
- `POST /api/predictions/risk` - Predict health risk
- `GET /api/predictions/:patientId/history` - Get prediction history
- `GET /api/predictions/anomaly/:patientId` - Detect anomalies

## 🔧 Configuration

### Alert Thresholds

Default alert thresholds can be configured per patient:

```javascript
alertSettings: {
  heartRate: { min: 60, max: 100 },
  temperature: { min: 36.1, max: 37.8 },
  spo2: { min: 95 },
  bloodPressure: { systolicMax: 140, diastolicMax: 90 }
}
```

### Notification Methods

Configure notification channels:
- `email` - Email notifications via SMTP
- `sms` - SMS via Twilio
- `push` - Firebase Cloud Messaging
- `dashboard` - In-app notifications

## 🤖 AI/ML Prediction

The system uses a simple risk assessment algorithm based on:

1. **Current Readings**: Heart rate, temperature, SpO2, blood pressure
2. **Trends**: Increasing/decreasing patterns over time
3. **Alert History**: Frequency of abnormal readings
4. **Patient History**: Pre-existing conditions

### Risk Levels
- **Low**: Score 0-29
- **Medium**: Score 30-49
- **High**: Score 50-69
- **Critical**: Score 70+

## 🔒 Security Considerations

- HTTPS in production
- JWT authentication for API access
- Rate limiting to prevent abuse
- Input validation on all endpoints
- Secure data transmission (TLS)
- Patient data encryption

## 📊 Monitoring Dashboard

The dashboard provides:
- Real-time patient status overview
- Live vital signs charts
- Alert management interface
- Device status monitoring
- Historical data analysis

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run with coverage
npm test -- --coverage
```

## 📦 Deployment

### Production Build
```bash
npm run build
```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["node", "backend/server.js"]
```

## 🛠️ Maintenance

### Database Backup
```bash
mongodump --db iot_health_monitor --out backup/
```

### Log Rotation
Logs are automatically rotated (5MB max, 5 files)

### Model Retraining
```bash
npm run ml
```

## 📝 License

This project is for educational and healthcare purposes. Ensure compliance with healthcare regulations (HIPAA, GDPR) before deployment.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📞 Support

For questions or issues, please open a GitHub issue or contact the development team.

---

Built with ❤️ for better healthcare monitoring
