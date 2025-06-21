@echo off
REM Medical Dashboard Initialization Script for Windows
REM This script helps initialize the project for GitHub and GCP deployment

setlocal EnableDelayedExpansion

echo ==================================================
echo    Medical Dashboard Initialization Script
echo ==================================================
echo.

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

:check_prerequisites
call :print_status "Checking prerequisites..."

set missing_tools=
where git >nul 2>nul
if errorlevel 1 set missing_tools=!missing_tools! git

where python >nul 2>nul
if errorlevel 1 set missing_tools=!missing_tools! python

where gcloud >nul 2>nul
if errorlevel 1 set missing_tools=!missing_tools! gcloud

if not "!missing_tools!"=="" (
    call :print_error "Missing required tools:!missing_tools!"
    echo.
    echo Please install the missing tools and run this script again.
    echo.
    echo Installation links:
    echo - Git: https://git-scm.com/downloads
    echo - Python: https://python.org/downloads
    echo - Google Cloud CLI: https://cloud.google.com/sdk/docs/install
    exit /b 1
)

call :print_success "All prerequisites are installed."
goto :eof

:setup_git_repository
call :print_status "Setting up Git repository..."

if not exist ".git" (
    git init
    call :print_success "Git repository initialized."
) else (
    call :print_warning "Git repository already exists."
)

REM Check if remote origin exists
git remote get-url origin >nul 2>nul
if errorlevel 1 (
    set /p REPO_URL="Enter your GitHub repository URL (e.g., https://github.com/username/medical-dashboard.git): "
    git remote add origin "!REPO_URL!"
    call :print_success "Remote origin added: !REPO_URL!"
) else (
    for /f "delims=" %%i in ('git remote get-url origin') do set EXISTING_ORIGIN=%%i
    call :print_warning "Remote origin already exists: !EXISTING_ORIGIN!"
)
goto :eof

:create_env_file
call :print_status "Setting up environment configuration..."

if not exist ".env" (
    copy .env.example .env >nul
    call :print_success "Created .env file from template."
    echo.
    call :print_warning "IMPORTANT: Please edit .env file with your actual configuration:"
    echo   - GEMINI_API_KEY: Get from https://makersuite.google.com/app/apikey
    echo   - FIREBASE_PROJECT_ID: Your Firebase project ID
    echo   - SECRET_KEY: Generate with: python -c "import secrets; print(secrets.token_hex(32))"
    echo.
) else (
    call :print_warning ".env file already exists."
)
goto :eof

:setup_service_account
call :print_status "Checking for Firebase service account key..."

if not exist "serviceAccountKey.json" (
    call :print_warning "Firebase service account key not found."
    echo.
    echo To set up Firebase service account:
    echo 1. Go to Firebase Console: https://console.firebase.google.com/
    echo 2. Select your project
    echo 3. Go to Project Settings ^> Service Accounts
    echo 4. Click 'Generate new private key'
    echo 5. Save the file as 'serviceAccountKey.json' in this directory
    echo.
    
    set /p has_key="Do you have the serviceAccountKey.json file ready? (y/N): "
    if /i "!has_key!"=="y" (
        set /p key_path="Enter the path to your serviceAccountKey.json file: "
        if exist "!key_path!" (
            copy "!key_path!" serviceAccountKey.json >nul
            call :print_success "Service account key copied."
        ) else (
            call :print_error "File not found: !key_path!"
            call :print_warning "Please manually copy your serviceAccountKey.json to this directory."
        )
    ) else (
        call :print_warning "Please add serviceAccountKey.json before deploying."
    )
) else (
    call :print_success "Service account key found."
)
goto :eof

:generate_secret_key
call :print_status "Generating Flask secret key..."

for /f "delims=" %%i in ('python -c "import secrets; print(secrets.token_hex(32))"') do set SECRET_KEY=%%i
echo.
call :print_success "Generated secret key: !SECRET_KEY!"
echo.
call :print_warning "Please add this to your .env file and GitHub Secrets:"
echo SECRET_KEY=!SECRET_KEY!
echo.
goto :eof

:show_github_secrets_setup
call :print_status "GitHub Secrets Setup Instructions"
echo.
echo Go to your GitHub repository settings and add these secrets:
echo Settings ^> Secrets and Variables ^> Actions ^> New repository secret
echo.
echo Required secrets:
echo ┌─────────────────────────────┬─────────────────────────────────────┐
echo │ Secret Name                 │ Value                               │
echo ├─────────────────────────────┼─────────────────────────────────────┤
echo │ GCP_PROJECT_ID              │ Your Google Cloud Project ID        │
echo │ GCP_SA_KEY                  │ Service account JSON (full content) │
echo │ GEMINI_API_KEY              │ Google Gemini API key               │
echo │ FIREBASE_PROJECT_ID         │ Firebase project ID                 │
echo │ FIREBASE_SERVICE_ACCOUNT_KEY│ Firebase service account JSON       │
echo │ SECRET_KEY                  │ Flask secret key (generated above)  │
echo └─────────────────────────────┴─────────────────────────────────────┘
echo.
goto :eof

:show_next_steps
call :print_status "Next Steps"
echo.
echo 1. Complete the configuration:
echo    ✓ Edit .env file with your actual values
echo    ✓ Add serviceAccountKey.json file
echo    ✓ Set up GitHub Secrets (shown above)
echo.
echo 2. Test locally:
echo    deploy.bat setup-local
echo    python app.py
echo.
echo 3. Deploy to production:
echo    git add .
echo    git commit -m "Initial deployment setup"
echo    git push origin main
echo.
echo 4. Monitor deployment:
echo    Check GitHub Actions tab for deployment status
echo.
call :print_success "Initialization completed!"
echo.
call :print_warning "Remember to complete the configuration steps before deploying!"
goto :eof

:main
call :check_prerequisites
echo.

call :setup_git_repository
echo.

call :create_env_file
echo.

call :setup_service_account
echo.

call :generate_secret_key
echo.

call :show_github_secrets_setup
echo.

call :show_next_steps

endlocal