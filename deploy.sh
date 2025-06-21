#!/bin/bash

# Medical Dashboard Deployment Script
# This script helps deploy the medical dashboard to Google Cloud Platform

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID=""
REGION="us-central1"
SERVICE_NAME="medical-dashboard"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v gcloud &> /dev/null; then
        print_error "Google Cloud CLI is not installed. Please install it first."
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install it first."
        exit 1
    fi
    
    print_success "All dependencies are installed."
}

# Function to setup Google Cloud
setup_gcloud() {
    print_status "Setting up Google Cloud..."
    
    if [ -z "$PROJECT_ID" ]; then
        read -p "Enter your Google Cloud Project ID: " PROJECT_ID
    fi
    
    gcloud config set project $PROJECT_ID
    gcloud config set run/region $REGION
    
    print_status "Enabling required APIs..."
    gcloud services enable cloudbuild.googleapis.com
    gcloud services enable run.googleapis.com
    gcloud services enable containerregistry.googleapis.com
    
    print_success "Google Cloud setup completed."
}

# Function to build and deploy
deploy_cloud_run() {
    print_status "Building and deploying to Cloud Run..."
    
    # Check if serviceAccountKey.json exists
    if [ ! -f "serviceAccountKey.json" ]; then
        print_error "serviceAccountKey.json not found. Please add your Firebase service account key."
        exit 1
    fi
    
    # Build the image
    print_status "Building Docker image..."
    gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME
    
    # Deploy to Cloud Run
    print_status "Deploying to Cloud Run..."
    gcloud run deploy $SERVICE_NAME \
        --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
        --platform managed \
        --region $REGION \
        --allow-unauthenticated \
        --memory 1Gi \
        --cpu 1 \
        --timeout 300 \
        --concurrency 100 \
        --min-instances 0 \
        --max-instances 10
    
    # Get the service URL
    SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')
    
    print_success "Deployment completed!"
    print_success "Your application is available at: $SERVICE_URL"
}

# Function to deploy to App Engine
deploy_app_engine() {
    print_status "Deploying to App Engine..."
    
    if [ ! -f "app.yaml" ]; then
        print_error "app.yaml not found. Please create it first."
        exit 1
    fi
    
    gcloud app deploy app.yaml --quiet
    
    APP_URL=$(gcloud app browse --no-launch-browser 2>&1 | grep -o 'https://[^[:space:]]*')
    print_success "App Engine deployment completed!"
    print_success "Your application is available at: $APP_URL"
}

# Function to setup local development
setup_local() {
    print_status "Setting up local development environment..."
    
    # Check if Python is installed
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 is not installed. Please install it first."
        exit 1
    fi
    
    # Create virtual environment
    if [ ! -d "venv" ]; then
        print_status "Creating virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    source venv/bin/activate 2>/dev/null || source venv/Scripts/activate
    
    # Install dependencies
    print_status "Installing dependencies..."
    pip install -r requirements.txt
    
    # Check if .env exists
    if [ ! -f ".env" ]; then
        print_warning ".env file not found. Copying from .env.example..."
        cp .env.example .env
        print_warning "Please edit .env file with your actual configuration."
    fi
    
    print_success "Local setup completed!"
    print_status "To run the application locally:"
    print_status "1. Activate the virtual environment: source venv/bin/activate"
    print_status "2. Run the application: python app.py"
}

# Function to run tests
run_tests() {
    print_status "Running tests..."
    
    # Activate virtual environment
    source venv/bin/activate 2>/dev/null || source venv/Scripts/activate
    
    # Install test dependencies
    pip install pytest pytest-cov bandit black isort
    
    # Run syntax check
    print_status "Running syntax checks..."
    python -m py_compile app.py
    python -m py_compile query_handler.py
    
    # Run security scan
    print_status "Running security scan..."
    bandit -r . -f json -o bandit-report.json || true
    
    # Run code formatting check
    print_status "Checking code formatting..."
    black --check . || print_warning "Code formatting issues found. Run 'black .' to fix."
    
    print_success "Tests completed!"
}

# Function to show help
show_help() {
    echo "Medical Dashboard Deployment Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  setup-local    Setup local development environment"
    echo "  deploy-run     Deploy to Google Cloud Run"
    echo "  deploy-gae     Deploy to Google App Engine"
    echo "  test           Run tests and checks"
    echo "  help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 setup-local"
    echo "  $0 deploy-run"
    echo "  $0 test"
}

# Main script logic
case "${1:-help}" in
    setup-local)
        setup_local
        ;;
    deploy-run)
        check_dependencies
        setup_gcloud
        deploy_cloud_run
        ;;
    deploy-gae)
        check_dependencies
        setup_gcloud
        deploy_app_engine
        ;;
    test)
        run_tests
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac