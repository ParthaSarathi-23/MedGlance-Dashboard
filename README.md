# Medical Dashboard

A comprehensive medical analytics dashboard built with Flask and Firebase, featuring real-time data visualization and natural language query capabilities.

## 🚀 Features

- **Real-time Analytics**: Weekly active users, query statistics, engagement metrics
- **Advanced Visualizations**: Charts for user demographics, peak usage hours, retention analysis
- **Natural Language Queries**: AI-powered database queries using Google Gemini
- **Medicine Search Analytics**: Track and analyze medicine-related searches
- **Responsive Design**: Modern, mobile-friendly interface
- **Auto-refresh**: Real-time data updates with configurable intervals

## 🏗️ Architecture

- **Backend**: Flask (Python)
- **Database**: Firebase Firestore
- **AI Integration**: Google Gemini API
- **Frontend**: HTML, CSS, JavaScript with Chart.js
- **Deployment**: Google Cloud Run / App Engine
- **CI/CD**: GitHub Actions

## 📋 Prerequisites

- Python 3.9 or higher
- Google Cloud Platform account
- Firebase project
- Google Gemini API key
- GitHub account

## 🛠️ Local Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/medical-dashboard.git
cd medical-dashboard
```

### 2. Create Virtual Environment

```bash
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables

Copy the `.env` file and update with your actual values:

```bash
cp .env .env.local
```

Update `.env.local` with your credentials:

```env
# Flask Configuration
FLASK_ENV=development
SECRET_KEY=your-secret-key-here
GEMINI_API_KEY=your-gemini-api-key-here

# Firebase Configuration
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_SERVICE_ACCOUNT_KEY=serviceAccountKey.json

# Dashboard Configuration
AUTO_REFRESH_INTERVAL=300000
MAX_RECORDS_PER_TABLE=1000
LOG_LEVEL=INFO
```

### 5. Setup Firebase

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Firestore Database
3. Generate a service account key:
   - Go to Project Settings > Service Accounts
   - Click "Generate new private key"
   - Save as `serviceAccountKey.json` in the project root

### 6. Get Google Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add it to your `.env.local` file

### 7. Run the Application

```bash
python app.py
```

Visit `http://localhost:5000` to see the dashboard.

## ☁️ Cloud Deployment

### Automated Deployment with GitHub Actions

This project includes automated CI/CD pipelines that deploy to Google Cloud Platform whenever you push to the main branch.

#### 1. Setup Google Cloud Project

1. Create a new project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the following APIs:
   - Cloud Run API
   - Container Registry API
   - App Engine Admin API (if using App Engine)

#### 2. Create Service Account

1. Go to IAM & Admin > Service Accounts
2. Create a new service account with these roles:
   - Cloud Run Admin
   - Storage Admin
   - Service Account User
   - Container Registry Service Agent

3. Generate a JSON key for the service account

#### 3. Configure GitHub Secrets

In your GitHub repository, go to Settings > Secrets and Variables > Actions, and add these secrets:

| Secret Name | Description | Example |
|------------|-------------|---------|
| `GCP_PROJECT_ID` | Your Google Cloud Project ID | `my-medical-dashboard` |
| `GCP_SA_KEY` | Service Account JSON key (entire file content) | `{"type": "service_account"...}` |
| `GEMINI_API_KEY` | Google Gemini API key | `AIzaSy...` |
| `FIREBASE_PROJECT_ID` | Firebase project ID | `medical-dashboard-12345` |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Firebase service account JSON | `{"type": "service_account"...}` |
| `SECRET_KEY` | Flask secret key | `your-secret-key-here` |

#### 4. Deploy

Once secrets are configured, simply push to the main branch:

```bash
git add .
git commit -m "Deploy medical dashboard"
git push origin main
```

The GitHub Actions workflow will:
1. Run tests and security scans
2. Build Docker image
3. Deploy to Google Cloud Run
4. Optionally deploy to App Engine as backup

### Manual Deployment

#### Deploy to Cloud Run

```bash
# Build and push Docker image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/medical-dashboard

# Deploy to Cloud Run
gcloud run deploy medical-dashboard \
  --image gcr.io/YOUR_PROJECT_ID/medical-dashboard \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="FLASK_ENV=production,GEMINI_API_KEY=your-key,FIREBASE_PROJECT_ID=your-project"
```

#### Deploy to App Engine

```bash
gcloud app deploy app.yaml
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `FLASK_ENV` | Flask environment mode | `development` |
| `SECRET_KEY` | Flask secret key for sessions | Required |
| `GEMINI_API_KEY` | Google Gemini API key | Required |
| `FIREBASE_PROJECT_ID` | Firebase project ID | Required |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Path to service account key | `serviceAccountKey.json` |
| `AUTO_REFRESH_INTERVAL` | Dashboard auto-refresh interval (ms) | `300000` |
| `MAX_RECORDS_PER_TABLE` | Maximum records per table | `1000` |
| `LOG_LEVEL` | Logging level | `INFO` |

### Firestore Schema

The application expects the following Firestore collections:

```
users/
├── {userId}/
│   ├── created_at: timestamp
│   ├── age: number
│   ├── display_name: string
│   ├── email_verified: boolean
│   ├── last_login: timestamp
│   └── chats/
│       └── {chatId}/
│           ├── created_at: timestamp
│           ├── message_count: number
│           └── conversations/
│               └── {conversationId}/
│                   ├── timestamp: timestamp
│                   ├── user_message: string
│                   └── bot_response: string
```

## 📊 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Main dashboard page |
| `/api/weekly-users` | GET | Weekly active users data |
| `/api/user-queries` | GET | User query statistics |
| `/api/medicine-search` | GET | Medicine search analytics |
| `/api/daily-engagement` | GET | Daily engagement metrics |
| `/api/demographics` | GET | User demographics |
| `/api/peak-hours` | GET | Peak usage hours |
| `/api/natural-query` | POST | Natural language queries |
| `/api/refresh-all` | GET | Refresh all dashboard data |

## 🧪 Testing

Run tests locally:

```bash
# Install test dependencies
pip install pytest pytest-cov bandit black isort

# Run syntax checks
python -m py_compile app.py

# Run security scan
bandit -r .

# Run code formatting check
black --check .
```

## 🔒 Security

- Service account keys are stored as GitHub Secrets
- Environment variables are properly configured
- Regular security scans with Bandit and Trivy
- Input validation for all API endpoints
- CORS and security headers configured

## 📝 Development Guidelines

### Code Style

- Use Black for code formatting: `black .`
- Use isort for import sorting: `isort .`
- Follow PEP 8 guidelines
- Maximum line length: 100 characters

### Commit Messages

Follow conventional commits:
- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation
- `style:` for formatting
- `refactor:` for code refactoring
- `test:` for tests

### Branching Strategy

- `main`: Production branch
- `develop`: Development branch
- `feature/*`: Feature branches
- `hotfix/*`: Hotfix branches

## 🚀 Monitoring and Observability

The application includes:
- Structured logging with configurable levels
- Health check endpoints
- Performance monitoring
- Error tracking
- Resource usage metrics

## 📈 Scaling

For high-traffic scenarios:
- Increase Cloud Run instances
- Configure autoscaling parameters
- Implement caching strategies
- Optimize database queries

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and security scans
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in GitHub
- Check the documentation
- Review existing issues and discussions

## 🔄 Changelog

### v1.0.0
- Initial release
- Basic dashboard functionality
- Firebase integration
- Natural language queries
- Google Cloud deployment

---

**Happy coding! 🚀**