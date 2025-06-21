# Medical Dashboard - Complete Setup Guide

This guide will walk you through setting up the Medical Dashboard project on GitHub and deploying it to Google Cloud Platform with automated CI/CD.

## 📋 Prerequisites Checklist

Before starting, ensure you have:

- [ ] Google Cloud Platform account with billing enabled
- [ ] Firebase project created
- [ ] Google Gemini API key
- [ ] GitHub account
- [ ] Local development environment (Python 3.9+, Git, Docker)

## 🔧 Step 1: Google Cloud Platform Setup

### 1.1 Create GCP Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Note your Project ID (you'll need this later)

### 1.2 Enable Required APIs

```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable appengine.googleapis.com
```

### 1.3 Create Service Account

1. Go to **IAM & Admin > Service Accounts**
2. Click **Create Service Account**
3. Name: `medical-dashboard-deploy`
4. Add these roles:
   - Cloud Run Admin
   - Storage Admin
   - Service Account User
   - Container Registry Service Agent
   - App Engine Admin (if using App Engine)

5. Create and download JSON key file

## 🔥 Step 2: Firebase Setup

### 2.1 Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create new project or use existing GCP project
3. Enable Firestore Database
4. Set up Firestore in production mode

### 2.2 Generate Service Account Key

1. Go to **Project Settings > Service Accounts**
2. Click **Generate new private key**
3. Download the JSON file as `serviceAccountKey.json`

### 2.3 Configure Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to all documents
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

## 🤖 Step 3: Google Gemini API Setup

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Save the key securely (you'll add it to GitHub Secrets)

## 📂 Step 4: GitHub Repository Setup

### 4.1 Create Repository

1. Create new repository on GitHub
2. Clone the repository locally:

```bash
git clone https://github.com/your-username/medical-dashboard.git
cd medical-dashboard
```

### 4.2 Copy Project Files

Copy all the files from your local project to the cloned repository:

```bash
# Copy all files (adjust paths as needed)
cp -r /path/to/your/medical_dashboard/* .
```

### 4.3 Configure GitHub Secrets

Go to **Settings > Secrets and Variables > Actions** and add these secrets:

| Secret Name | Value | Description |
|------------|--------|-------------|
| `GCP_PROJECT_ID` | Your GCP Project ID | e.g., `medical-dashboard-12345` |
| `GCP_SA_KEY` | Full JSON content of service account key | Entire content of the downloaded JSON file |
| `GEMINI_API_KEY` | Your Gemini API key | e.g., `AIzaSy...` |
| `FIREBASE_PROJECT_ID` | Firebase project ID | Usually same as GCP Project ID |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Firebase service account JSON | Content of `serviceAccountKey.json` |
| `SECRET_KEY` | Flask secret key | Generate with `python -c "import secrets; print(secrets.token_hex(32))"` |

**Optional secrets for enhanced features:**
| Secret Name | Value | Description |
|------------|--------|-------------|
| `DOCKERHUB_USERNAME` | Docker Hub username | For Docker Hub integration |
| `DOCKERHUB_TOKEN` | Docker Hub token | For updating Docker Hub description |

## 🚀 Step 5: Initial Deployment

### 5.1 Prepare Your Code

1. **Update environment variables** in `.env`:

```env
FLASK_ENV=development
SECRET_KEY=your-secret-key-here
GEMINI_API_KEY=your-gemini-api-key
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_SERVICE_ACCOUNT_KEY=serviceAccountKey.json
AUTO_REFRESH_INTERVAL=300000
MAX_RECORDS_PER_TABLE=1000
LOG_LEVEL=INFO
```

2. **Add your service account key**:
   - Place `serviceAccountKey.json` in the project root
   - Make sure it's in `.gitignore` (it already is)

### 5.2 Test Locally

```bash
# Set up local environment
./deploy.sh setup-local  # Linux/Mac
# OR
deploy.bat setup-local   # Windows

# Run the application
python app.py
```

Visit `http://localhost:5000` to verify everything works.

### 5.3 Deploy to GitHub

```bash
git add .
git commit -m "Initial commit: Medical Dashboard setup"
git push origin main
```

This will trigger the GitHub Actions workflow and deploy to GCP automatically!

## 🔍 Step 6: Verify Deployment

### 6.1 Check GitHub Actions

1. Go to **Actions** tab in your GitHub repository
2. Watch the deployment workflow
3. Check for any errors in the logs

### 6.2 Access Your Application

After successful deployment, you'll find your application URLs in:

- **Cloud Run**: Check the GitHub Actions logs or GCP Console
- **App Engine**: `https://PROJECT_ID.appspot.com`

## ⚙️ Step 7: Configuration Options

### 7.1 Update App Configuration

Edit `app.yaml` for App Engine settings:

```yaml
runtime: python39
env: standard

env_variables:
  FLASK_ENV: production
  # Other variables are set via GitHub Secrets

automatic_scaling:
  min_instances: 0
  max_instances: 10
  target_cpu_utilization: 0.6

resources:
  cpu: 1
  memory_gb: 1
  disk_size_gb: 10
```

### 7.2 Update Cloud Run Settings

Modify deployment in `.github/workflows/deploy.yml`:

```yaml
- name: Deploy to Cloud Run
  run: |
    gcloud run deploy $SERVICE_NAME \
      --image gcr.io/$PROJECT_ID/$SERVICE_NAME:${{ github.sha }} \
      --platform managed \
      --region $REGION \
      --allow-unauthenticated \
      --memory 2Gi \        # Increase memory
      --cpu 2 \             # Increase CPU
      --timeout 300 \
      --concurrency 100 \
      --min-instances 1 \   # Keep warm instance
      --max-instances 20    # Scale to more instances
```

## 🔐 Step 8: Security Best Practices

### 8.1 Environment Variables

- Never commit secrets to Git
- Use GitHub Secrets for sensitive data
- Regularly rotate API keys and service account keys

### 8.2 Firestore Security

Update Firestore security rules for production:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Restrict access based on your requirements
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /users/{userId}/chats/{chatId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Add more specific rules as needed
  }
}
```

### 8.3 Network Security

For production deployments:

1. Configure VPC and firewall rules
2. Use Cloud Armor for DDoS protection
3. Set up SSL certificates
4. Configure proper CORS policies

## 📊 Step 9: Monitoring and Logging

### 9.1 Enable Monitoring

1. Go to **Operations > Monitoring** in GCP Console
2. Set up alerting policies
3. Configure uptime checks

### 9.2 View Logs

```bash
# Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=medical-dashboard" --limit 50

# App Engine logs
gcloud logging read "resource.type=gae_app" --limit 50
```

### 9.3 Performance Monitoring

Add application performance monitoring:

```python
# Add to app.py
import google.cloud.logging

# Initialize Google Cloud Logging
client = google.cloud.logging.Client()
client.setup_logging()
```

## 🔄 Step 10: Continuous Integration

### 10.1 Automated Testing

The CI/CD pipeline includes:

- Code syntax validation
- Security scanning with Bandit
- Docker image building and testing
- Deployment to staging/production

### 10.2 Release Management

Create releases with:

```bash
git tag v1.0.0
git push origin v1.0.0
```

This triggers the release workflow that creates GitHub releases with deployment packages.

## 🛠️ Troubleshooting

### Common Issues

1. **Permission Denied**
   - Check service account roles
   - Verify GitHub Secrets are set correctly

2. **Build Failures**
   - Check `requirements.txt` for version conflicts
   - Verify Dockerfile syntax

3. **Runtime Errors**
   - Check environment variables
   - Verify service account key format

4. **Firestore Connection Issues**
   - Ensure Firestore is enabled
   - Check service account permissions

### Debug Commands

```bash
# Check local environment
python -c "import firebase_admin; print('Firebase OK')"

# Test Docker build
docker build -t test-medical-dashboard .

# Check GCP configuration
gcloud config list
gcloud auth list
```

## 📞 Support

If you encounter issues:

1. Check the [GitHub Issues](https://github.com/your-username/medical-dashboard/issues)
2. Review the deployment logs in GitHub Actions
3. Check GCP logs in Cloud Console
4. Verify all secrets and environment variables

## ✅ Post-Deployment Checklist

- [ ] Application accessible via provided URL
- [ ] All dashboard features working
- [ ] Natural language queries functioning
- [ ] Data loading correctly from Firestore
- [ ] Monitoring and alerting set up
- [ ] SSL certificate configured
- [ ] Backup strategy implemented
- [ ] Documentation updated

---

🎉 **Congratulations!** Your Medical Dashboard is now deployed and running on Google Cloud Platform with automated CI/CD!

For ongoing maintenance and updates, simply push changes to the main branch, and the deployment will happen automatically.