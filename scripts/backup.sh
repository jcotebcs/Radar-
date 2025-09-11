#!/bin/bash

# Radar Notes Backup Script
# Automated backup solution for data persistence

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
DATA_DIR="${DATA_DIR:-/app/data}"
LOG_FILE="${LOG_FILE:-/app/logs/backup.log}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
BACKUP_NAME="radar-notes-$(date +%Y%m%d-%H%M%S)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging function
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        INFO)
            echo -e "${GREEN}[INFO]${NC} $message"
            echo "[$timestamp] [INFO] $message" >> "$LOG_FILE"
            ;;
        WARN)
            echo -e "${YELLOW}[WARN]${NC} $message"
            echo "[$timestamp] [WARN] $message" >> "$LOG_FILE"
            ;;
        ERROR)
            echo -e "${RED}[ERROR]${NC} $message"
            echo "[$timestamp] [ERROR] $message" >> "$LOG_FILE"
            ;;
    esac
}

# Create backup directory
create_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        mkdir -p "$BACKUP_DIR"
        log INFO "Created backup directory: $BACKUP_DIR"
    fi
}

# Backup application data
backup_data() {
    log INFO "Starting backup: $BACKUP_NAME"
    
    local backup_path="$BACKUP_DIR/$BACKUP_NAME"
    mkdir -p "$backup_path"
    
    # Backup application files
    if [ -d "/app" ]; then
        log INFO "Backing up application files..."
        tar -czf "$backup_path/app-files.tar.gz" -C /app \
            --exclude='node_modules' \
            --exclude='logs' \
            --exclude='*.log' \
            .
        log INFO "Application files backed up"
    fi
    
    # Backup data directory
    if [ -d "$DATA_DIR" ]; then
        log INFO "Backing up data directory..."
        tar -czf "$backup_path/data.tar.gz" -C "$DATA_DIR" .
        log INFO "Data directory backed up"
    fi
    
    # Backup logs (last 1000 lines of each log file)
    if [ -d "/app/logs" ]; then
        log INFO "Backing up recent logs..."
        mkdir -p "$backup_path/logs"
        for logfile in /app/logs/*.log; do
            if [ -f "$logfile" ]; then
                tail -1000 "$logfile" > "$backup_path/logs/$(basename $logfile)"
            fi
        done
        log INFO "Recent logs backed up"
    fi
    
    # Create backup manifest
    cat > "$backup_path/manifest.json" << EOF
{
    "backup_name": "$BACKUP_NAME",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "version": "1.0",
    "contents": [
        "app-files.tar.gz",
        "data.tar.gz",
        "logs/"
    ],
    "environment": {
        "hostname": "$(hostname)",
        "node_version": "$(node --version 2>/dev/null || echo 'N/A')",
        "backup_script_version": "1.0"
    }
}
EOF
    
    log INFO "Backup manifest created"
    
    # Calculate backup size
    local backup_size=$(du -sh "$backup_path" | cut -f1)
    log INFO "Backup completed: $backup_path ($backup_size)"
}

# Clean old backups
cleanup_old_backups() {
    log INFO "Cleaning up backups older than $RETENTION_DAYS days..."
    
    local cleaned=0
    while IFS= read -r -d '' backup; do
        rm -rf "$backup"
        cleaned=$((cleaned + 1))
        log INFO "Removed old backup: $(basename "$backup")"
    done < <(find "$BACKUP_DIR" -type d -name "radar-notes-*" -mtime +$RETENTION_DAYS -print0)
    
    if [ $cleaned -eq 0 ]; then
        log INFO "No old backups to clean up"
    else
        log INFO "Cleaned up $cleaned old backup(s)"
    fi
}

# Backup Redis data (if Redis is available)
backup_redis() {
    if command -v redis-cli &> /dev/null; then
        log INFO "Backing up Redis data..."
        local backup_path="$BACKUP_DIR/$BACKUP_NAME"
        
        # Create Redis backup
        redis-cli BGSAVE
        
        # Wait for backup to complete
        while [ "$(redis-cli LASTSAVE)" = "$(redis-cli LASTSAVE)" ]; do
            sleep 1
        done
        
        # Copy the dump file
        if [ -f "/data/dump.rdb" ]; then
            cp /data/dump.rdb "$backup_path/redis-dump.rdb"
            log INFO "Redis data backed up"
        else
            log WARN "Redis dump file not found"
        fi
    fi
}

# Verify backup integrity
verify_backup() {
    local backup_path="$BACKUP_DIR/$BACKUP_NAME"
    log INFO "Verifying backup integrity..."
    
    # Check if backup directory exists
    if [ ! -d "$backup_path" ]; then
        log ERROR "Backup directory not found: $backup_path"
        return 1
    fi
    
    # Verify tar files
    for tarfile in "$backup_path"/*.tar.gz; do
        if [ -f "$tarfile" ]; then
            if tar -tzf "$tarfile" >/dev/null 2>&1; then
                log INFO "Archive verified: $(basename "$tarfile")"
            else
                log ERROR "Archive corrupted: $(basename "$tarfile")"
                return 1
            fi
        fi
    done
    
    # Verify manifest
    if [ -f "$backup_path/manifest.json" ]; then
        if python3 -m json.tool "$backup_path/manifest.json" >/dev/null 2>&1; then
            log INFO "Manifest verified"
        else
            log ERROR "Manifest corrupted"
            return 1
        fi
    fi
    
    log INFO "Backup verification completed successfully"
}

# Send backup notification (optional)
send_notification() {
    if [ -n "$WEBHOOK_URL" ]; then
        local status=$1
        local message="Radar Notes backup $status: $BACKUP_NAME"
        
        curl -X POST "$WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"$message\"}" \
            >/dev/null 2>&1 || log WARN "Failed to send notification"
    fi
}

# Main backup function
main() {
    log INFO "Starting backup process..."
    
    # Ensure log directory exists
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Create backup directory
    create_backup_dir
    
    # Perform backup
    backup_data
    backup_redis
    
    # Verify backup
    if verify_backup; then
        log INFO "Backup process completed successfully"
        send_notification "completed"
    else
        log ERROR "Backup verification failed"
        send_notification "failed"
        exit 1
    fi
    
    # Clean old backups
    cleanup_old_backups
    
    log INFO "Backup process finished"
}

# Run backup
main "$@"