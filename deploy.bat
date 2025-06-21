@echo off
REM Medical Dashboard Deployment Script for Windows
REM This script helps deploy the medical dashboard to Google Cloud Platform

setlocal EnableDelayedExpansion

REM Configuration
set PROJECT_ID=
set REGION=us-central1
set SERVICE_NAME=medical-dashboard

REM Function to print colored output (simplified for Windows)
goto main

:print_status
echo [INFO] %~1
goto :eof

:print_success
echo [SUCCESS] %~1
goto :eof

:print_warning
echo [WARNING] %~1
goto :eof

:print_error
echo [ERROR] %~1
goto :eof

:check_dependencies
call :print_status "Checking dependencies..."

where gcloud >nul 2>nul
if errorlevel 1 (
    call :print_error "Google Cloud CLI is not installed. Please install it first."
    exit /b 1
)

where docker >nul 2>nul
if errorlevel 1 (
    call :print_error "Docker is not installed. Please install it first."
    exit /b 1
)

call :print_success "All dependencies are installed."
goto :eof

:setup_gcloud
call :print_status "Setting up Google Cloud..."

if "%PROJECT_ID%"=="" (
    set /p PROJECT_ID="Enter your Google Cloud Project ID: "
)

gcloud config set project %PROJECT_ID%
gcloud config set run/region %REGION%

call :print_status "Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

call :print_success "Google Cloud setup completed."
goto :eof

:deploy_cloud_run
call :print_status "Building and deploying to Cloud Run..."

if not exist "serviceAccountKey.json" (
    call :print_error "serviceAccountKey.json not found. Please add your Firebase service account key."
    exit /b 1
)

REM Build the image
call :print_status "Building Docker image..."
gcloud builds submit --tag gcr.io/%PROJECT_ID%/%SERVICE_NAME%

REM Deploy to Cloud Run
call :print_status "Deploying to Cloud Run..."
gcloud run deploy %SERVICE_NAME% --image gcr.io/%PROJECT_ID%/%SERVICE_NAME% --platform managed --region %REGION% --allow-unauthenticated --memory 1Gi --cpu 1 --timeout 300 --concurrency 100 --min-instances 0 --max-instances 10

REM Get the service URL
for /f "delims=" %%i in ('gcloud run services describe %SERVICE_NAME% --platform managed --region %REGION% --format "value(status.url)"') do set SERVICE_URL=%%i

call :print_success "Deployment completed!"
call :print_success "Your application is available at: %SERVICE_URL%"
goto :eof

:deploy_app_engine
call :print_status "Deploying to App Engine..."

if not exist "app.yaml" (
    call :print_error "app.yaml not found. Please create it first."
    exit /b 1
)

gcloud app deploy app.yaml --quiet

call :print_success "App Engine deployment completed!"
call :print_success "Check Google Cloud Console for your application URL."
goto :eof

:setup_local
call :print_status "Setting up local development environment..."

where python >nul 2>nul
if errorlevel 1 (
    call :print_error "Python is not installed. Please install it first."
    exit /b 1
)

REM Create virtual environment
if not exist "venv" (
    call :print_status "Creating virtual environment..."
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Install dependencies
call :print_status "Installing dependencies..."
pip install -r requirements.txt

REM Check if .env exists
if not exist ".env" (
    call :print_warning ".env file not found. Copying from .env.example..."
    copy .env.example .env
    call :print_warning "Please edit .env file with your actual configuration."
)

call :print_success "Local setup completed!"
call :print_status "To run the application locally:"
call :print_status "1. Activate the virtual environment: venv\Scripts\activate.bat"
call :print_status "2. Run the application: python app.py"
goto :eof

:run_tests
call :print_status "Running tests..."

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Install test dependencies
pip install pytest pytest-cov bandit black isort

REM Run syntax check
call :print_status "Running syntax checks..."
python -m py_compile app.py
python -m py_compile query_handler.py

REM Run security scan
call :print_status "Running security scan..."
bandit -r . -f json -o bandit-report.json || echo Security scan completed

REM Run code formatting check
call :print_status "Checking code formatting..."
black --check . || call :print_warning "Code formatting issues found. Run 'black .' to fix."

call :print_success "Tests completed!"
goto :eof

:show_help
echo Medical Dashboard Deployment Script for Windows
echo.
echo Usage: %0 [COMMAND]
echo.
echo Commands:
echo   setup-local    Setup local development environment
echo   deploy-run     Deploy to Google Cloud Run
echo   deploy-gae     Deploy to Google App Engine
echo   test           Run tests and checks
echo   help           Show this help message
echo.
echo Examples:
echo   %0 setup-local
echo   %0 deploy-run
echo   %0 test
goto :eof

:main
REM Main script logic
set COMMAND=%1
if "%COMMAND%"=="" set COMMAND=help

if "%COMMAND%"=="setup-local" (
    call :setup_local
) else if "%COMMAND%"=="deploy-run" (
    call :check_dependencies
    call :setup_gcloud
    call :deploy_cloud_run
) else if "%COMMAND%"=="deploy-gae" (
    call :check_dependencies
    call :setup_gcloud
    call :deploy_app_engine
) else if "%COMMAND%"=="test" (
    call :run_tests
) else if "%COMMAND%"=="help" (
    call :show_help
) else if "%COMMAND%"=="--help" (
    call :show_help
) else if "%COMMAND%"=="-h" (
    call :show_help
) else (
    call :print_error "Unknown command: %COMMAND%"
    call :show_help
    exit /b 1
)

endlocal