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
- PostgreSQL database (Railway or Neon)
- Socket.IO for real-time bidirectional communication
- Chart.js for interactive data visualization
- JWT authentication
- ESP32 hardware integration for sensor data collection

## 🏗️ System Architecture

```
Sensors (MAX30102, DS18B20)
        ↓
    ESP32 Microcontroller
        ↓
    WiFi/Cloud Server
        ↓
    Node.js Backend (Railway)
        ↓
    PostgreSQL Database
        ↓
    Frontend Dashboard
```

## 📁 Project Structure

```
medical-iot/
├── backend/
│   ├── models/           # Database models (PostgreSQL)
│   ├── routes/           # API endpoints
│   ├── services/         # Business logic
│   ├── middleware/       # Express middleware
│   ├── utils/            # Utilities
│   └── server.js         # Main entry point
├── frontend/
│   ├── index.html        # Landing page
│   ├── dashboard.html    # Main dashboard
│   ├── patients.html     # Patient management
│   ├── alerts.html       # Alerts view
│   ├── devices.html      # Device management
│   ├── analytics.html    # Analytics
│   ├── settings.html     # Settings
│   ├── login.html        # Login
│   ├── signup.html       # Signup
│   ├── css/              # Stylesheets
│   └── js/               # Frontend JavaScript
├── hardware/
│   └── esp32_health_monitor/
│       └── esp32_health_monitor.ino  # ESP32 firmware
├── .env.example          # Environment template
├── package.json          # Dependencies
├── Procfile              # Railway deployment
└── README.md             # This file
```

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js v18+
- PostgreSQL (local or Neon)

### Backend Setup

```bash
cd medical-iot

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Configure .env with your PostgreSQL connection string
# DATABASE_URL=postgres://user:password@host:5432/database

# Start development server
npm run dev
```

### Frontend

Open `frontend/index.html` in a browser, or serve with:
```bash
npx serve frontend
```

## 🚂 Railway Deployment

### Prerequisites
- [Railway Account](https://railway.app/) (free tier available)
- GitHub repository

### Deployment Steps

#### 1. Create New Project on Railway
1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository

#### 2. Add PostgreSQL Database
1. In Railway project, click "Add Plugin" → "PostgreSQL"
2. Railway will automatically set `DATABASE_URL` variable
3. Note: Railway PostgreSQL URL format:
   ```
   postgres://postgres:password@shortline.proxy.rlwy.net:52121/railway
   ```

#### 3. Set Environment Variables
In Railway project settings, add:
```
JWT_SECRET=your-super-secret-jwt-key-min-32-characters
NODE_ENV=production
FRONTEND_URL=https://your-app-name.railway.app
```

#### 4. Deploy
- Railway detects `Procfile` and deploys automatically
- Health check: `https://your-app.railway.app/health`
- API docs: `https://your-app.railway.app/api`

### Railway Troubleshooting

#### Health Check Failing
1. Check logs: Railway Dashboard → Deployments → View Logs
2. Verify `DATABASE_URL` is set correctly
3. Ensure PostgreSQL plugin is added

#### Database Connection Issues
- Use Railway's PostgreSQL plugin (not external)
- Internal URL (`postgres.railway.internal`) may not work - use proxy URL

#### CORS Errors
- Update `FRONTEND_URL` in Railway variables
- Restart deployment after changing variables

## 📡 API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Patients
- `GET /api/patients` - List all patients
- `POST /api/patients` - Create patient
- `GET /api/patients/:id` - Get patient details
- `PUT /api/patients/:id` - Update patient
- `DELETE /api/patients/:id` - Delete patient

### Health Data
- `POST /api/health-data` - Submit sensor data
- `GET /api/health-data/:patientId` - Get patient readings
- `GET /api/health-data/:patientId/latest` - Latest reading

### Alerts
- `GET /api/alerts` - List all alerts
- `POST /api/alerts` - Create alert
- `PUT /api/alerts/:id/acknowledge` - Acknowledge
- `PUT /api/alerts/:id/resolve` - Resolve

### Devices
- `GET /api/devices` - List devices
- `POST /api/devices` - Register device
- `PUT /api/devices/:id/status` - Update status

## 📊 Health Monitoring

### Alert Thresholds
```javascript
alertSettings: {
  heartRate: { min: 60, max: 100 },
  temperature: { min: 36.1, max: 37.8 },
  spo2: { min: 95 },
  bloodPressure: { systolicMax: 140, diastolicMax: 90 }
}
```

### Risk Levels
- **Low**: Score 0-29
- **Medium**: Score 30-49
- **High**: Score 50-69
- **Critical**: Score 70+

## 🔧 Hardware Setup (ESP32)

1. Install Arduino libraries:
   - WiFi.h (built-in)
   - HTTPClient
   - Wire.h (built-in)
   - MAX30105 Library
   - OneWire Library
   - DallasTemperature Library

2. Configure in [`esp32_health_monitor.ino`](hardware/esp32_health_monitor/esp32_health_monitor.ino):
   ```cpp
   const char* WIFI_SSID = "your_wifi_ssid";
   const char* WIFI_PASSWORD = "your_wifi_password";
   const char* SERVER_URL = "https://your-app.railway.app/api/health-data";
   ```

## 🧪 Testing

```bash
# Run tests
npm test
```

## 🛠️ Maintenance

### Database Backup (Railway)
Use Railway's automatic backups or connect with psql CLI:
```bash
pg_dump "DATABASE_URL" > backup.sql
```

### View Logs
```bash
railway logs
```

## 🔒 Security

- Change `JWT_SECRET` in production
- Use HTTPS (Railway provides this)
- Rate limiting enabled
- Input validation on all endpoints

## 📝 License

MIT License - For educational and healthcare purposes.

---

Built with ❤️ for better healthcare monitoring
