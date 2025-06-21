#!/bin/bash

# Medical Dashboard Initialization Script
# This script helps initialize the project for GitHub and GCP deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${PURPLE}"
    echo "=================================================="
    echo "   Medical Dashboard Initialization Script"
    echo "=================================================="
    echo -e "${NC}"
}

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

check_prerequisites() {
    print_status "Checking prerequisites..."
    
    local missing_tools=()
    
    if ! command -v git &> /dev/null; then
        missing_tools+=("git")
    fi
    
    if ! command -v python3 &> /dev/null; then
        missing_tools+=("python3")
    fi
    
    if ! command -v gcloud &> /dev/null; then
        missing_tools+=("gcloud")
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        print_error "Missing required tools: ${missing_tools[*]}"
        echo ""
        echo "Please install the missing tools and run this script again."
        echo ""
        echo "Installation links:"
        echo "- Git: https://git-scm.com/downloads"
        echo "- Python: https://python.org/downloads"
        echo "- Google Cloud CLI: https://cloud.google.com/sdk/docs/install"
        exit 1
    fi
    
    print_success "All prerequisites are installed."
}

setup_git_repository() {
    print_status "Setting up Git repository..."
    
    if [ ! -d ".git" ]; then
        git init
        print_success "Git repository initialized."
    else
        print_warning "Git repository already exists."
    fi
    
    # Check if remote origin exists
    if ! git remote get-url origin &> /dev/null; then
        read -p "Enter your GitHub repository URL (e.g., https://github.com/username/medical-dashboard.git): " REPO_URL
        git remote add origin "$REPO_URL"
        print_success "Remote origin added: $REPO_URL"
    else
        EXISTING_ORIGIN=$(git remote get-url origin)
        print_warning "Remote origin already exists: $EXISTING_ORIGIN"
    fi
}

create_env_file() {
    print_status "Setting up environment configuration..."
    
    if [ ! -f ".env" ]; then
        cp .env.example .env
        print_success "Created .env file from template."
        
        echo ""
        print_warning "IMPORTANT: Please edit .env file with your actual configuration:"
        echo "  - GEMINI_API_KEY: Get from https://makersuite.google.com/app/apikey"
        echo "  - FIREBASE_PROJECT_ID: Your Firebase project ID"
        echo "  - SECRET_KEY: Generate with: python -c \"import secrets; print(secrets.token_hex(32))\""
        echo ""
    else
        print_warning ".env file already exists."
    fi
}

setup_service_account() {
    print_status "Checking for Firebase service account key..."
    
    if [ ! -f "serviceAccountKey.json" ]; then
        print_warning "Firebase service account key not found."
        echo ""
        echo "To set up Firebase service account:"
        echo "1. Go to Firebase Console: https://console.firebase.google.com/"
        echo "2. Select your project"
        echo "3. Go to Project Settings > Service Accounts"
        echo "4. Click 'Generate new private key'"
        echo "5. Save the file as 'serviceAccountKey.json' in this directory"
        echo ""
        
        read -p "Do you have the serviceAccountKey.json file ready? (y/N): " has_key
        if [[ $has_key =~ ^[Yy]$ ]]; then
            read -p "Enter the path to your serviceAccountKey.json file: " key_path
            if [ -f "$key_path" ]; then
                cp "$key_path" serviceAccountKey.json
                print_success "Service account key copied."
            else
                print_error "File not found: $key_path"
                print_warning "Please manually copy your serviceAccountKey.json to this directory."
            fi
        else
            print_warning "Please add serviceAccountKey.json before deploying."
        fi
    else
        print_success "Service account key found."
    fi
}

generate_secret_key() {
    print_status "Generating Flask secret key..."
    
    SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    echo ""
    print_success "Generated secret key: $SECRET_KEY"
    echo ""
    print_warning "Please add this to your .env file and GitHub Secrets:"
    echo "SECRET_KEY=$SECRET_KEY"
    echo ""
}

show_github_secrets_setup() {
    print_status "GitHub Secrets Setup Instructions"
    echo ""
    echo "Go to your GitHub repository settings and add these secrets:"
    echo "Settings > Secrets and Variables > Actions > New repository secret"
    echo ""
    echo "Required secrets:"
    echo "┌─────────────────────────────┬─────────────────────────────────────┐"
    echo "│ Secret Name                 │ Value                               │"
    echo "├─────────────────────────────┼─────────────────────────────────────┤"
    echo "│ GCP_PROJECT_ID              │ Your Google Cloud Project ID        │"
    echo "│ GCP_SA_KEY                  │ Service account JSON (full content) │"
    echo "│ GEMINI_API_KEY              │ Google Gemini API key               │"
    echo "│ FIREBASE_PROJECT_ID         │ Firebase project ID                 │"
    echo "│ FIREBASE_SERVICE_ACCOUNT_KEY│ Firebase service account JSON       │"
    echo "│ SECRET_KEY                  │ Flask secret key (generated above)  │"
    echo "└─────────────────────────────┴─────────────────────────────────────┘"
    echo ""
}

show_next_steps() {
    print_status "Next Steps"
    echo ""
    echo "1. Complete the configuration:"
    echo "   ✓ Edit .env file with your actual values"
    echo "   ✓ Add serviceAccountKey.json file"
    echo "   ✓ Set up GitHub Secrets (shown above)"
    echo ""
    echo "2. Test locally:"
    echo "   ./deploy.sh setup-local"
    echo "   python app.py"
    echo ""
    echo "3. Deploy to production:"
    echo "   git add ."
    echo "   git commit -m \"Initial deployment setup\""
    echo "   git push origin main"
    echo ""
    echo "4. Monitor deployment:"
    echo "   Check GitHub Actions tab for deployment status"
    echo ""
    print_success "Initialization completed!"
    echo ""
    print_warning "Remember to complete the configuration steps before deploying!"
}

main() {
    print_header
    
    check_prerequisites
    echo ""
    
    setup_git_repository
    echo ""
    
    create_env_file
    echo ""
    
    setup_service_account
    echo ""
    
    generate_secret_key
    echo ""
    
    show_github_secrets_setup
    echo ""
    
    show_next_steps
}

# Run main function
main