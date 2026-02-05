# 🚂 Railway Deployment Checklist for Medical IoT System

## Pre-Deployment Checklist

- [ ] **Git Repository**: Ensure code is pushed to GitHub
- [ ] **MongoDB Ready**: Have MongoDB Atlas connection string ready OR use Railway's MongoDB plugin
- [ ] **Environment Variables**: Prepare all required environment variables (see below)
- [ ] **Railway Account**: Create account at [railway.app](https://railway.app)

## Required Environment Variables for Railway

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Required for Railway |
| `JWT_SECRET` | (32+ char string) | For authentication |
| `FRONTEND_URL` | `https://your-app.railway.app` | Your Railway URL |
| `MONGODB_URI` | (MongoDB Atlas string) OR use Railway MongoDB plugin | Database connection |

## Optional Environment Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `FIREBASE_PROJECT_ID` | Firebase project ID | Push notifications |
| `FIREBASE_PRIVATE_KEY` | Firebase private key | Firebase auth |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account | Firebase auth |
| `SMTP_HOST` | `smtp.gmail.com` | Email alerts |
| `SMTP_USER` | Your email | Email sender |
| `SMTP_PASS` | App password | Email auth |
| `TWILIO_ACCOUNT_SID` | Twilio SID | SMS alerts |
| `TWILIO_AUTH_TOKEN` | Twilio token | SMS auth |
| `LOG_LEVEL` | `info` | Logging level |

## 🚀 Deployment Steps

### Option 1: Railway Dashboard (Recommended)

1. **Create New Project**:
   - Go to [Railway Dashboard](https://railway.app/dashboard)
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository

2. **Add MongoDB** (Choose one):
   - Option A: Click "Add Plugin" → "MongoDB" (easiest)
   - Option B: Use MongoDB Atlas and add `MONGODB_URI` variable

3. **Configure Variables**:
   - Go to "Variables" tab
   - Add:
     ```
     NODE_ENV=production
     JWT_SECRET=your-super-secret-key-here
     FRONTEND_URL=https://your-project-name.railway.app
     ```

4. **Deploy**:
   - Railway auto-detects `Procfile` and `package.json`
   - Click "Deploy" and wait for build

5. **Verify**:
   - Visit `https://your-project-name.railway.app/health`
   - Should return `{"status":"healthy"}`

### Option 2: Railway CLI

```bash
# 1. Install Railway CLI
npm i -g @railway/cli

# 2. Login
railway login

# 3. Initialize project
railway init

# 4. Add MongoDB
railway add mongodb

# 5. Set required variables
railway variables set NODE_ENV=production
railway variables set JWT_SECRET=your-secret-key
railway variables set FRONTEND_URL=https://your-app.railway.app

# 6. Deploy
railway up

# 7. View logs
railway logs
```

## 🔧 Post-Deployment Configuration

1. **Update ESP32 Firmware**:
   - Change `SERVER_URL` in `hardware/esp32_health_monitor/esp32_health_monitor.ino`:
   ```cpp
   const char* SERVER_URL = "https://your-app.railway.app/api/health-data";
   ```

2. **Test the System**:
   - Health check: `https://your-app.railway.app/health`
   - API status: `https://your-app.railway.app/api/status`
   - Dashboard: `https://your-app.railway.app`

## 📋 Quick Reference

| Endpoint | URL | Purpose |
|----------|-----|---------|
| Health Check | `https://your-app.railway.app/health` | Server status |
| API Base | `https://your-app.railway.app/api` | All API endpoints |
| Dashboard | `https://your-app.railway.app` | Web interface |

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| App won't start | Check `railway logs` for errors |
| Database not connecting | Verify `MONGODB_URI` or add MongoDB plugin |
| CORS errors | Update `FRONTEND_URL` variable |
| 500 Error | Check environment variables are set |
| Static files not loading | Ensure `frontend/` directory exists |

## 📞 Support

- Railway Docs: https://docs.railway.app
- MongoDB Atlas: https://docs.atlas.mongodb.com
- Project Issues: GitHub Issues

---

**✅ Deployment Complete!** Your Medical IoT system is now running on Railway.
