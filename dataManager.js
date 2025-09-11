const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class DataManager {
  constructor() {
    this.dataFile = 'data/app-data.json';
    this.backupDir = 'backups';
    this.data = {
      tallies: {},
      contacts: [
        { id: 1, name: 'Alice', phone: '+15551234567' },
        { id: 2, name: 'Bob', phone: '+15557654321' }
      ],
      callLogs: [
        { id: 1, contact: 'Alice', type: 'incoming', time: Date.now() - 600000, duration: 120 },
        { id: 2, contact: 'Bob', type: 'outgoing', time: Date.now() - 3600000, duration: 240 }
      ],
      timers: {},
      settings: {}
    };
    this.init();
  }

  async init() {
    try {
      // Ensure data directory exists
      await fs.mkdir('data', { recursive: true });
      await fs.mkdir(this.backupDir, { recursive: true });
      
      // Load existing data
      await this.loadData();
      
      // Set up periodic backup
      this.startBackupSchedule();
      
      logger.info('DataManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize DataManager:', error);
    }
  }

  async loadData() {
    try {
      const data = await fs.readFile(this.dataFile, 'utf8');
      this.data = { ...this.data, ...JSON.parse(data) };
      logger.info('Data loaded from file');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error('Error loading data:', error);
      } else {
        logger.info('No existing data file found, using defaults');
      }
    }
  }

  async saveData() {
    try {
      await fs.writeFile(this.dataFile, JSON.stringify(this.data, null, 2));
      logger.debug('Data saved to file');
    } catch (error) {
      logger.error('Error saving data:', error);
      throw error;
    }
  }

  async createBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(this.backupDir, `backup-${timestamp}.json`);
      
      await fs.copyFile(this.dataFile, backupFile);
      logger.info(`Backup created: ${backupFile}`);
      
      // Clean old backups
      await this.cleanOldBackups();
    } catch (error) {
      logger.error('Error creating backup:', error);
    }
  }

  async cleanOldBackups() {
    try {
      const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS) || 30;
      const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
      
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files.filter(f => f.startsWith('backup-') && f.endsWith('.json'));
      
      for (const file of backupFiles) {
        const filePath = path.join(this.backupDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          await fs.unlink(filePath);
          logger.info(`Deleted old backup: ${file}`);
        }
      }
    } catch (error) {
      logger.error('Error cleaning old backups:', error);
    }
  }

  startBackupSchedule() {
    const intervalHours = parseInt(process.env.BACKUP_INTERVAL_HOURS) || 24;
    const intervalMs = intervalHours * 60 * 60 * 1000;
    
    setInterval(() => {
      this.createBackup();
    }, intervalMs);
    
    logger.info(`Backup scheduled every ${intervalHours} hours`);
  }

  // Data access methods
  getTallies() {
    return this.data.tallies;
  }

  async setTally(name, value) {
    this.data.tallies[name] = value;
    await this.saveData();
  }

  getContacts() {
    return this.data.contacts;
  }

  getCallLogs() {
    return this.data.callLogs;
  }

  getTimers() {
    return this.data.timers;
  }

  async setTimer(id, timer) {
    this.data.timers[id] = timer;
    await this.saveData();
  }

  async removeTimer(id) {
    delete this.data.timers[id];
    await this.saveData();
  }
}

module.exports = DataManager;