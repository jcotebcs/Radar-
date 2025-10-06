#!/usr/bin/env node

/**
 * Radar Notes Application Validation Script
 * 
 * This script performs comprehensive validation of the Police Radar application
 * including testing all API endpoints, checking data persistence, and validating
 * frontend functionality.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

class RadarValidator {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.results = [];
    this.passed = 0;
    this.failed = 0;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    console.log(logMessage);
    this.results.push({ timestamp, type, message });
  }

  async request(method, path, data = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'RadarValidator/1.0'
        }
      };

      const req = http.request(url, options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const responseData = body ? JSON.parse(body) : null;
            resolve({ 
              status: res.statusCode, 
              headers: res.headers, 
              data: responseData 
            });
          } catch (error) {
            resolve({ 
              status: res.statusCode, 
              headers: res.headers, 
              data: body 
            });
          }
        });
      });

      req.on('error', reject);
      
      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  async test(description, testFn) {
    try {
      this.log(`Testing: ${description}`);
      await testFn();
      this.log(`✅ PASS: ${description}`, 'pass');
      this.passed++;
    } catch (error) {
      this.log(`❌ FAIL: ${description} - ${error.message}`, 'fail');
      this.failed++;
    }
  }

  async validateHealthEndpoint() {
    await this.test('Health endpoint', async () => {
      const response = await this.request('GET', '/api/health');
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      if (!response.data.status || response.data.status !== 'healthy') {
        throw new Error('Health status not healthy');
      }
    });
  }

  async validateRecordingWorkflow() {
    let recordingId;

    await this.test('Start recording', async () => {
      const response = await this.request('POST', '/api/recording/start', {
        title: 'Test Recording'
      });
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      recordingId = response.data.recordingId;
      if (!recordingId) {
        throw new Error('No recording ID returned');
      }
    });

    await this.test('Add tag to recording', async () => {
      const response = await this.request('POST', '/api/recording/tag', {
        recordingId,
        tag: 'Test Tag'
      });
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
    });

    await this.test('Stop recording', async () => {
      const response = await this.request('POST', '/api/recording/stop', {
        recordingId
      });
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
    });

    await this.test('List recordings', async () => {
      const response = await this.request('GET', '/api/recordings');
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      if (!Array.isArray(response.data)) {
        throw new Error('Recordings response not an array');
      }
    });
  }

  async validateTimerEndpoints() {
    await this.test('Start timer', async () => {
      const response = await this.request('POST', '/api/timer/start', {
        title: 'Test Timer',
        seconds: 60
      });
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
    });

    await this.test('Get timer status', async () => {
      const response = await this.request('GET', '/api/timer/status');
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      if (!response.data.running) {
        throw new Error('Timer should be running');
      }
    });

    await this.test('Stop timer', async () => {
      const response = await this.request('POST', '/api/timer/stop');
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
    });
  }

  async validateTallyEndpoints() {
    const timestamp = Date.now();
    const counterName = `Test Counter ${timestamp}`;
    
    await this.test('Create tally counter', async () => {
      const response = await this.request('POST', '/api/tally/create', {
        name: counterName
      });
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
    });

    await this.test('Increment tally counter', async () => {
      const response = await this.request('POST', '/api/tally/increment', {
        name: counterName,
        amount: 1
      });
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
    });

    await this.test('Get tally counters', async () => {
      const response = await this.request('GET', '/api/tally');
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      if (typeof response.data !== 'object') {
        throw new Error('Tally response not an object');
      }
    });
  }

  async validateChatEndpoint() {
    await this.test('Chat with Radar Oriley', async () => {
      const response = await this.request('POST', '/api/chat', {
        message: 'Hello, Radar Oriley!'
      });
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      if (!response.data.reply) {
        throw new Error('No reply from chatbot');
      }
    });
  }

  async validateStaticFiles() {
    const staticFiles = ['/', '/style.css', '/app.js', '/manifest.json'];
    
    for (const file of staticFiles) {
      await this.test(`Static file: ${file}`, async () => {
        const response = await this.request('GET', file);
        if (response.status !== 200) {
          throw new Error(`Expected 200, got ${response.status}`);
        }
      });
    }
  }

  async validateDataPersistence() {
    await this.test('Data directory exists', async () => {
      const dataDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        throw new Error('Data directory does not exist');
      }
    });

    await this.test('Recordings directory exists', async () => {
      const recordingsDir = path.join(process.cwd(), 'data', 'recordings');
      if (!fs.existsSync(recordingsDir)) {
        throw new Error('Recordings directory does not exist');
      }
    });
  }

  async validateSecurityHeaders() {
    await this.test('Security headers present', async () => {
      const response = await this.request('GET', '/');
      
      const requiredHeaders = [
        'x-content-type-options',
        'x-frame-options',
        'x-xss-protection'
      ];
      
      for (const header of requiredHeaders) {
        if (!response.headers[header]) {
          throw new Error(`Missing security header: ${header}`);
        }
      }
    });
  }

  async validateInputValidation() {
    await this.test('Invalid JSON handling', async () => {
      try {
        const response = await this.request('POST', '/api/chat', null);
        // Should not crash the server
        if (response.status >= 500) {
          throw new Error('Server error on invalid input');
        }
      } catch (error) {
        if (error.code !== 'ECONNRESET') {
          throw error;
        }
      }
    });

    await this.test('XSS protection', async () => {
      const response = await this.request('POST', '/api/chat', {
        message: '<script>alert("xss")</script>'
      });
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      // Should not return unescaped script tags
      if (response.data.reply && response.data.reply.includes('<script>')) {
        throw new Error('XSS vulnerability detected');
      }
    });
  }

  generateReport() {
    const total = this.passed + this.failed;
    const passRate = total > 0 ? ((this.passed / total) * 100).toFixed(1) : 0;
    
    console.log('\n' + '='.repeat(60));
    console.log('RADAR NOTES VALIDATION REPORT');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${this.passed} (${passRate}%)`);
    console.log(`Failed: ${this.failed}`);
    console.log(`Status: ${this.failed === 0 ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    console.log('='.repeat(60));

    // Save detailed report
    const reportPath = path.join(process.cwd(), 'validation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: { total, passed: this.passed, failed: this.failed, passRate },
      results: this.results
    }, null, 2));
    
    console.log(`Detailed report saved to: ${reportPath}`);
    
    return this.failed === 0;
  }

  async runAllTests() {
    this.log('Starting Radar Notes validation...');
    
    try {
      await this.validateHealthEndpoint();
      await this.validateRecordingWorkflow();
      await this.validateTimerEndpoints();
      await this.validateTallyEndpoints();
      await this.validateChatEndpoint();
      await this.validateStaticFiles();
      await this.validateDataPersistence();
      await this.validateSecurityHeaders();
      await this.validateInputValidation();
    } catch (error) {
      this.log(`Validation error: ${error.message}`, 'error');
    }
    
    return this.generateReport();
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new RadarValidator();
  validator.runAllTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('Validation failed:', error);
      process.exit(1);
    });
}

module.exports = RadarValidator;