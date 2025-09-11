const fs = require('fs');
const path = require('path');

class ExportUtilities {
  constructor() {
    this.exportDir = path.join(__dirname, '..', 'exports');
    this.ensureExportDir();
  }

  ensureExportDir() {
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  // General export formats
  async exportToJSON(data, filename) {
    const filePath = path.join(this.exportDir, `${filename}.json`);
    const jsonData = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, jsonData);
    return filePath;
  }

  async exportToCSV(data, filename) {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('CSV export requires non-empty array');
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    const filePath = path.join(this.exportDir, `${filename}.csv`);
    fs.writeFileSync(filePath, csvContent);
    return filePath;
  }

  async exportToMarkdown(data, filename) {
    let markdown = '';

    if (data.title) {
      markdown += `# ${data.title}\n\n`;
    }

    if (data.metadata) {
      markdown += `## Metadata\n`;
      Object.entries(data.metadata).forEach(([key, value]) => {
        markdown += `- **${key}**: ${value}\n`;
      });
      markdown += '\n';
    }

    if (data.summary) {
      markdown += `## Summary\n${data.summary}\n\n`;
    }

    if (data.tags && data.tags.length > 0) {
      markdown += `## Tags\n${data.tags.map(tag => `#${tag}`).join(' ')}\n\n`;
    }

    if (data.actionItems && data.actionItems.length > 0) {
      markdown += `## Action Items\n`;
      data.actionItems.forEach(item => {
        markdown += `- [ ] ${item}\n`;
      });
      markdown += '\n';
    }

    if (data.transcript) {
      markdown += `## Transcript\n${data.transcript}\n\n`;
    }

    if (data.events && data.events.length > 0) {
      markdown += `## Events\n`;
      data.events.forEach(event => {
        markdown += `### ${event.title}\n`;
        markdown += `- **Date**: ${event.date}\n`;
        if (event.location) markdown += `- **Location**: ${event.location}\n`;
        if (event.description) markdown += `- **Description**: ${event.description}\n`;
        markdown += '\n';
      });
    }

    if (data.contacts && data.contacts.length > 0) {
      markdown += `## Contacts\n`;
      data.contacts.forEach(contact => {
        markdown += `- **${contact.name}**: ${contact.phone || contact.email || ''}\n`;
      });
      markdown += '\n';
    }

    const filePath = path.join(this.exportDir, `${filename}.md`);
    fs.writeFileSync(filePath, markdown);
    return filePath;
  }

  // iCalendar format for calendar events
  async exportToICS(events, filename) {
    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Radar Notes//Radar Notes//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ];

    events.forEach(event => {
      const startDate = new Date(event.startTime || event.date);
      const endDate = new Date(event.endTime || new Date(startDate.getTime() + 60 * 60 * 1000));

      icsContent.push(
        'BEGIN:VEVENT',
        `UID:${event.id || this.generateUID()}@radarnotes.com`,
        `DTSTAMP:${this.formatICSDate(new Date())}`,
        `DTSTART:${this.formatICSDate(startDate)}`,
        `DTEND:${this.formatICSDate(endDate)}`,
        `SUMMARY:${event.title || 'Radar Note Event'}`,
        `DESCRIPTION:${event.description || event.summary || ''}`,
        event.location ? `LOCATION:${event.location}` : '',
        'END:VEVENT'
      );
    });

    icsContent.push('END:VCALENDAR');
    
    const filePath = path.join(this.exportDir, `${filename}.ics`);
    fs.writeFileSync(filePath, icsContent.filter(line => line).join('\r\n'));
    return filePath;
  }

  // OPML format for mind maps and outlines
  async exportToOPML(data, filename) {
    let opmlContent = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<opml version="1.0">',
      '<head>',
      `<title>${data.title || 'Radar Notes Export'}</title>`,
      `<dateCreated>${new Date().toUTCString()}</dateCreated>`,
      '<ownerName>Radar Notes</ownerName>',
      '</head>',
      '<body>'
    ];

    if (data.outline && Array.isArray(data.outline)) {
      data.outline.forEach(item => {
        opmlContent.push(this.formatOPMLOutline(item));
      });
    } else {
      // Convert note structure to outline
      if (data.summary) {
        opmlContent.push(`<outline text="Summary" _note="${this.escapeXML(data.summary)}" />`);
      }
      
      if (data.actionItems && data.actionItems.length > 0) {
        opmlContent.push('<outline text="Action Items">');
        data.actionItems.forEach(item => {
          opmlContent.push(`<outline text="${this.escapeXML(item)}" />`);
        });
        opmlContent.push('</outline>');
      }

      if (data.tags && data.tags.length > 0) {
        opmlContent.push('<outline text="Tags">');
        data.tags.forEach(tag => {
          opmlContent.push(`<outline text="${this.escapeXML(tag)}" />`);
        });
        opmlContent.push('</outline>');
      }
    }

    opmlContent.push('</body>', '</opml>');
    
    const filePath = path.join(this.exportDir, `${filename}.opml`);
    fs.writeFileSync(filePath, opmlContent.join('\n'));
    return filePath;
  }

  // Export for Google Takeout compatibility
  async exportGoogleTakeoutFormat(data, filename) {
    const takeoutData = {
      kind: 'radar#note',
      title: data.title,
      created: data.created || new Date().toISOString(),
      updated: data.updated || new Date().toISOString(),
      content: {
        transcript: data.transcript,
        summary: data.summary,
        tags: data.tags || [],
        actionItems: data.actionItems || []
      },
      metadata: {
        source: 'Radar Notes',
        version: '1.0.0',
        exportDate: new Date().toISOString()
      }
    };

    const filePath = path.join(this.exportDir, `${filename}_takeout.json`);
    fs.writeFileSync(filePath, JSON.stringify(takeoutData, null, 2));
    return filePath;
  }

  // Export for Microsoft 365 compatibility
  async exportMicrosoft365Format(data, filename) {
    const m365Data = {
      '@odata.type': '#microsoft.graph.driveItem',
      name: data.title || 'Radar Note',
      description: data.summary,
      content: {
        transcript: data.transcript,
        tags: data.tags,
        actionItems: data.actionItems
      },
      createdDateTime: data.created || new Date().toISOString(),
      lastModifiedDateTime: data.updated || new Date().toISOString()
    };

    const filePath = path.join(this.exportDir, `${filename}_m365.json`);
    fs.writeFileSync(filePath, JSON.stringify(m365Data, null, 2));
    return filePath;
  }

  // Utility methods
  formatICSDate(date) {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  generateUID() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  escapeXML(str) {
    return str.replace(/[<>&'"]/g, (char) => {
      switch (char) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case "'": return '&apos;';
        case '"': return '&quot;';
        default: return char;
      }
    });
  }

  formatOPMLOutline(item, indent = 0) {
    const spaces = '  '.repeat(indent);
    if (item.children && item.children.length > 0) {
      let result = `${spaces}<outline text="${this.escapeXML(item.text)}">`;
      item.children.forEach(child => {
        result += '\n' + this.formatOPMLOutline(child, indent + 1);
      });
      result += `\n${spaces}</outline>`;
      return result;
    } else {
      return `${spaces}<outline text="${this.escapeXML(item.text)}" />`;
    }
  }

  // Get all export files for a session
  getExportFiles(sessionId) {
    const files = fs.readdirSync(this.exportDir);
    return files
      .filter(file => file.startsWith(sessionId))
      .map(file => ({
        name: file,
        path: path.join(this.exportDir, file),
        size: fs.statSync(path.join(this.exportDir, file)).size,
        created: fs.statSync(path.join(this.exportDir, file)).mtime
      }));
  }

  // Clean up old export files
  cleanupOldExports(daysOld = 7) {
    const files = fs.readdirSync(this.exportDir);
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    
    files.forEach(file => {
      const filePath = path.join(this.exportDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtime < cutoffDate) {
        fs.unlinkSync(filePath);
      }
    });
  }
}

module.exports = ExportUtilities;