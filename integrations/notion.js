const axios = require('axios');

class NotionIntegration {
  constructor() {
    this.apiKey = process.env.NOTION_API_KEY;
    this.baseUrl = 'https://api.notion.com/v1';
    this.headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    };

    if (!this.apiKey) {
      console.log('Notion API not configured - set NOTION_API_KEY');
    }
  }

  async createDatabase(title, parentPageId) {
    if (!this.apiKey) throw new Error('Notion API key not configured');

    const data = {
      parent: {
        type: 'page_id',
        page_id: parentPageId
      },
      title: [
        {
          type: 'text',
          text: {
            content: title
          }
        }
      ],
      properties: {
        Name: {
          title: {}
        },
        Tags: {
          multi_select: {
            options: []
          }
        },
        'Created': {
          created_time: {}
        },
        'Recording Date': {
          date: {}
        },
        'Transcript': {
          rich_text: {}
        },
        'Summary': {
          rich_text: {}
        },
        'Action Items': {
          rich_text: {}
        }
      }
    };

    const response = await axios.post(`${this.baseUrl}/databases`, data, { headers: this.headers });
    return response.data;
  }

  async createPage(databaseId, pageData) {
    if (!this.apiKey) throw new Error('Notion API key not configured');

    const data = {
      parent: {
        database_id: databaseId
      },
      properties: {
        Name: {
          title: [
            {
              text: {
                content: pageData.title || 'Radar Recording'
              }
            }
          ]
        }
      },
      children: []
    };

    // Add transcript block
    if (pageData.transcript) {
      data.children.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: 'Transcript:'
              },
              annotations: {
                bold: true
              }
            }
          ]
        }
      });
      data.children.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: pageData.transcript
              }
            }
          ]
        }
      });
    }

    // Add summary block
    if (pageData.summary) {
      data.children.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: 'Summary:'
              },
              annotations: {
                bold: true
              }
            }
          ]
        }
      });
      data.children.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: pageData.summary
              }
            }
          ]
        }
      });
    }

    // Add action items
    if (pageData.actionItems && pageData.actionItems.length > 0) {
      data.children.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: 'Action Items:'
              },
              annotations: {
                bold: true
              }
            }
          ]
        }
      });

      pageData.actionItems.forEach(item => {
        data.children.push({
          object: 'block',
          type: 'to_do',
          to_do: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: item
                }
              }
            ],
            checked: false
          }
        });
      });
    }

    // Add tags to properties
    if (pageData.tags && pageData.tags.length > 0) {
      data.properties.Tags = {
        multi_select: pageData.tags.map(tag => ({ name: tag }))
      };
    }

    // Add recording date
    if (pageData.recordingDate) {
      data.properties['Recording Date'] = {
        date: {
          start: pageData.recordingDate
        }
      };
    }

    const response = await axios.post(`${this.baseUrl}/pages`, data, { headers: this.headers });
    return response.data;
  }

  async updatePage(pageId, updates) {
    if (!this.apiKey) throw new Error('Notion API key not configured');

    const data = {
      properties: {}
    };

    if (updates.title) {
      data.properties.Name = {
        title: [
          {
            text: {
              content: updates.title
            }
          }
        ]
      };
    }

    if (updates.tags) {
      data.properties.Tags = {
        multi_select: updates.tags.map(tag => ({ name: tag }))
      };
    }

    const response = await axios.patch(`${this.baseUrl}/pages/${pageId}`, data, { headers: this.headers });
    return response.data;
  }

  async searchPages(query) {
    if (!this.apiKey) throw new Error('Notion API key not configured');

    const data = {
      query: query,
      sort: {
        direction: 'descending',
        timestamp: 'last_edited_time'
      }
    };

    const response = await axios.post(`${this.baseUrl}/search`, data, { headers: this.headers });
    return response.data.results;
  }

  async getDatabases() {
    if (!this.apiKey) throw new Error('Notion API key not configured');

    const data = {
      filter: {
        value: 'database',
        property: 'object'
      }
    };

    const response = await axios.post(`${this.baseUrl}/search`, data, { headers: this.headers });
    return response.data.results;
  }

  // Export functionality for compatibility
  formatForExport(noteData) {
    const exportData = {
      title: noteData.title || 'Radar Recording',
      date: noteData.recordingDate || new Date().toISOString(),
      transcript: noteData.transcript || '',
      summary: noteData.summary || '',
      tags: noteData.tags || [],
      actionItems: noteData.actionItems || [],
      metadata: {
        source: 'Radar Notes',
        version: '1.0.0'
      }
    };

    return {
      json: exportData,
      markdown: this.convertToMarkdown(exportData),
      text: this.convertToText(exportData)
    };
  }

  convertToMarkdown(data) {
    let markdown = `# ${data.title}\n\n`;
    markdown += `**Date:** ${new Date(data.date).toLocaleDateString()}\n\n`;
    
    if (data.tags.length > 0) {
      markdown += `**Tags:** ${data.tags.map(tag => `#${tag}`).join(' ')}\n\n`;
    }

    if (data.summary) {
      markdown += `## Summary\n${data.summary}\n\n`;
    }

    if (data.actionItems.length > 0) {
      markdown += `## Action Items\n`;
      data.actionItems.forEach(item => {
        markdown += `- [ ] ${item}\n`;
      });
      markdown += '\n';
    }

    if (data.transcript) {
      markdown += `## Transcript\n${data.transcript}\n`;
    }

    return markdown;
  }

  convertToText(data) {
    let text = `${data.title}\n`;
    text += `Date: ${new Date(data.date).toLocaleDateString()}\n`;
    
    if (data.tags.length > 0) {
      text += `Tags: ${data.tags.join(', ')}\n`;
    }
    text += '\n';

    if (data.summary) {
      text += `Summary:\n${data.summary}\n\n`;
    }

    if (data.actionItems.length > 0) {
      text += `Action Items:\n`;
      data.actionItems.forEach((item, index) => {
        text += `${index + 1}. ${item}\n`;
      });
      text += '\n';
    }

    if (data.transcript) {
      text += `Transcript:\n${data.transcript}\n`;
    }

    return text;
  }
}

module.exports = NotionIntegration;