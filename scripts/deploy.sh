#!/bin/bash

# Radar Notes Deployment Script
# This script automates the deployment process for the Radar Notes PWA

set -e  # Exit on any error

# Configuration
PROJECT_NAME="radar-notes"
DEPLOY_USER="${DEPLOY_USER:-radar}"
DEPLOY_HOST="${DEPLOY_HOST:-localhost}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/radar-notes}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/radar-notes}"
NGINX_CONFIG_PATH="${NGINX_CONFIG_PATH:-/etc/nginx/sites-available/radar-notes}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi
    
    # Check if docker is available (optional)
    if command -v docker &> /dev/null; then
        log_info "Docker is available"
        DOCKER_AVAILABLE=true
    else
        log_warn "Docker is not available - skipping containerized deployment"
        DOCKER_AVAILABLE=false
    fi
    
    log_info "Prerequisites check completed"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    npm ci --only=production
    log_info "Dependencies installed"
}

# Build the application
build_application() {
    log_info "Building application..."
    npm run build
    log_info "Application built successfully"
}

# Create backup of current deployment
create_backup() {
    if [ -d "$DEPLOY_PATH" ]; then
        log_info "Creating backup of current deployment..."
        sudo mkdir -p "$BACKUP_DIR"
        BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
        sudo cp -r "$DEPLOY_PATH" "$BACKUP_DIR/$BACKUP_NAME"
        log_info "Backup created: $BACKUP_DIR/$BACKUP_NAME"
    fi
}

# Deploy application files
deploy_files() {
    log_info "Deploying application files..."
    
    # Create deployment directory
    sudo mkdir -p "$DEPLOY_PATH"
    
    # Copy built files
    sudo cp -r dist/* "$DEPLOY_PATH/"
    sudo cp server.js "$DEPLOY_PATH/"
    sudo cp googleApis.js "$DEPLOY_PATH/"
    sudo cp package.json "$DEPLOY_PATH/"
    sudo cp package-lock.json "$DEPLOY_PATH/"
    
    # Copy environment file if it exists
    if [ -f ".env" ]; then
        sudo cp .env "$DEPLOY_PATH/"
    else
        log_warn ".env file not found - using defaults"
    fi
    
    # Set proper ownership
    sudo chown -R "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_PATH"
    
    log_info "Application files deployed"
}

# Configure nginx
configure_nginx() {
    if command -v nginx &> /dev/null; then
        log_info "Configuring nginx..."
        
        # Copy nginx configuration
        sudo cp nginx.conf "$NGINX_CONFIG_PATH"
        
        # Enable site
        sudo ln -sf "$NGINX_CONFIG_PATH" /etc/nginx/sites-enabled/
        
        # Test nginx configuration
        if sudo nginx -t; then
            log_info "Nginx configuration is valid"
            sudo systemctl reload nginx
            log_info "Nginx reloaded"
        else
            log_error "Nginx configuration is invalid"
            exit 1
        fi
    else
        log_warn "Nginx not found - skipping nginx configuration"
    fi
}

# Install and configure systemd service
configure_systemd() {
    log_info "Configuring systemd service..."
    
    cat > /tmp/radar-notes.service << EOF
[Unit]
Description=Radar Notes PWA Server
After=network.target

[Service]
Type=simple
User=$DEPLOY_USER
WorkingDirectory=$DEPLOY_PATH
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF
    
    sudo cp /tmp/radar-notes.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable radar-notes
    
    log_info "Systemd service configured"
}

# Start/restart services
restart_services() {
    log_info "Restarting services..."
    
    # Install dependencies in deployment directory
    cd "$DEPLOY_PATH"
    sudo -u "$DEPLOY_USER" npm ci --only=production
    
    # Restart radar-notes service
    sudo systemctl restart radar-notes
    
    # Check service status
    if sudo systemctl is-active --quiet radar-notes; then
        log_info "Radar Notes service is running"
    else
        log_error "Failed to start Radar Notes service"
        sudo systemctl status radar-notes
        exit 1
    fi
}

# Deploy with Docker
deploy_docker() {
    if [ "$DOCKER_AVAILABLE" = true ]; then
        log_info "Deploying with Docker..."
        
        # Build Docker image
        docker build -t radar-notes:latest .
        
        # Stop existing container
        docker stop radar-notes-app 2>/dev/null || true
        docker rm radar-notes-app 2>/dev/null || true
        
        # Start new container
        docker run -d \
            --name radar-notes-app \
            --restart unless-stopped \
            -p 3000:3000 \
            -v "$(pwd)/logs:/app/logs" \
            -v "$(pwd)/.env:/app/.env" \
            radar-notes:latest
        
        log_info "Docker deployment completed"
    fi
}

# Health check
health_check() {
    log_info "Performing health check..."
    
    # Wait a moment for the service to start
    sleep 5
    
    # Check if the service responds
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        log_info "Health check passed"
    else
        log_error "Health check failed"
        exit 1
    fi
}

# Main deployment function
main() {
    log_info "Starting Radar Notes deployment..."
    
    # Parse command line arguments
    DEPLOYMENT_TYPE="standard"
    while [[ $# -gt 0 ]]; do
        case $1 in
            --docker)
                DEPLOYMENT_TYPE="docker"
                shift
                ;;
            --help)
                echo "Usage: $0 [--docker] [--help]"
                echo "  --docker    Deploy using Docker containers"
                echo "  --help      Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    check_prerequisites
    
    if [ "$DEPLOYMENT_TYPE" = "docker" ]; then
        deploy_docker
    else
        install_dependencies
        build_application
        create_backup
        deploy_files
        configure_nginx
        configure_systemd
        restart_services
    fi
    
    health_check
    
    log_info "Deployment completed successfully!"
    log_info "Application is available at: http://localhost:3000"
    log_info "Health check endpoint: http://localhost:3000/health"
}

# Run main function
main "$@"