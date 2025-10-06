const axios = require('axios');

class SquareIntegration {
  constructor() {
    this.accessToken = process.env.SQUARE_ACCESS_TOKEN;
    this.environment = process.env.SQUARE_ENVIRONMENT || 'sandbox'; // 'sandbox' or 'production'
    this.applicationId = process.env.SQUARE_APPLICATION_ID;
    
    this.baseUrl = this.environment === 'production' 
      ? 'https://connect.squareup.com/v2'
      : 'https://connect.squareupsandbox.com/v2';
    
    this.headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      'Square-Version': '2023-10-18'
    };

    if (!this.accessToken) {
      console.log('Square API not configured - set SQUARE_ACCESS_TOKEN and SQUARE_APPLICATION_ID');
    }
  }

  // Payment processing for premium features
  async createPayment(amount, currency = 'USD', source) {
    if (!this.accessToken) throw new Error('Square access token not configured');

    const data = {
      source_id: source.token,
      idempotency_key: this.generateIdempotencyKey(),
      amount_money: {
        amount: amount, // Amount in smallest currency unit (cents for USD)
        currency: currency
      },
      autocomplete: true,
      note: 'Radar Notes Premium Features'
    };

    const response = await axios.post(`${this.baseUrl}/payments`, data, { headers: this.headers });
    return response.data;
  }

  // Create subscription for premium features
  async createSubscription(planId, customerId) {
    if (!this.accessToken) throw new Error('Square access token not configured');

    const data = {
      idempotency_key: this.generateIdempotencyKey(),
      location_id: await this.getLocationId(),
      plan_id: planId,
      customer_id: customerId,
      start_date: new Date().toISOString().split('T')[0],
      charged_through_date: new Date().toISOString().split('T')[0],
      status: 'ACTIVE'
    };

    const response = await axios.post(`${this.baseUrl}/subscriptions`, data, { headers: this.headers });
    return response.data;
  }

  // Customer management
  async createCustomer(email, firstName, lastName) {
    if (!this.accessToken) throw new Error('Square access token not configured');

    const data = {
      given_name: firstName,
      family_name: lastName,
      email_address: email
    };

    const response = await axios.post(`${this.baseUrl}/customers`, data, { headers: this.headers });
    return response.data;
  }

  async getCustomer(customerId) {
    if (!this.accessToken) throw new Error('Square access token not configured');

    const response = await axios.get(`${this.baseUrl}/customers/${customerId}`, { headers: this.headers });
    return response.data;
  }

  // Invoicing for professional services
  async createInvoice(invoiceData) {
    if (!this.accessToken) throw new Error('Square access token not configured');

    const data = {
      invoice: {
        location_id: await this.getLocationId(),
        order_request: {
          order: {
            location_id: await this.getLocationId(),
            line_items: invoiceData.items.map(item => ({
              name: item.name,
              quantity: item.quantity.toString(),
              base_price_money: {
                amount: item.price,
                currency: 'USD'
              }
            }))
          }
        },
        primary_recipient: {
          customer_id: invoiceData.customerId
        },
        payment_requests: [
          {
            request_method: 'EMAIL',
            request_type: 'BALANCE',
            due_date: invoiceData.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          }
        ],
        delivery_method: 'EMAIL',
        invoice_number: invoiceData.invoiceNumber || this.generateInvoiceNumber(),
        title: invoiceData.title || 'Radar Notes Services',
        description: invoiceData.description || 'Professional voice note services',
        scheduled_at: new Date().toISOString(),
        accepted_payment_methods: {
          card: true,
          square_gift_card: false,
          bank_account: false,
          buy_now_pay_later: false
        }
      }
    };

    const response = await axios.post(`${this.baseUrl}/invoices`, data, { headers: this.headers });
    return response.data;
  }

  async publishInvoice(invoiceId) {
    if (!this.accessToken) throw new Error('Square access token not configured');

    const data = {
      request_method: 'EMAIL'
    };

    const response = await axios.post(`${this.baseUrl}/invoices/${invoiceId}/publish`, data, { headers: this.headers });
    return response.data;
  }

  // Catalog management for products/services
  async createCatalogItem(itemData) {
    if (!this.accessToken) throw new Error('Square access token not configured');

    const data = {
      idempotency_key: this.generateIdempotencyKey(),
      object: {
        type: 'ITEM',
        id: `#${itemData.name.replace(/\s+/g, '_').toLowerCase()}`,
        item_data: {
          name: itemData.name,
          description: itemData.description,
          variations: [
            {
              type: 'ITEM_VARIATION',
              id: `#${itemData.name.replace(/\s+/g, '_').toLowerCase()}_variation`,
              item_variation_data: {
                item_id: `#${itemData.name.replace(/\s+/g, '_').toLowerCase()}`,
                name: 'Regular',
                pricing_type: 'FIXED_PRICING',
                price_money: {
                  amount: itemData.price,
                  currency: 'USD'
                }
              }
            }
          ]
        }
      }
    };

    const response = await axios.post(`${this.baseUrl}/catalog/object`, data, { headers: this.headers });
    return response.data;
  }

  // Get sales analytics
  async getPayments(beginTime, endTime) {
    if (!this.accessToken) throw new Error('Square access token not configured');

    const params = new URLSearchParams({
      begin_time: beginTime || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      end_time: endTime || new Date().toISOString(),
      sort_order: 'DESC'
    });

    const response = await axios.get(`${this.baseUrl}/payments?${params}`, { headers: this.headers });
    return response.data;
  }

  // Point of Sale integration for in-person services
  async createCheckout(checkoutData) {
    if (!this.accessToken) throw new Error('Square access token not configured');

    const data = {
      idempotency_key: this.generateIdempotencyKey(),
      ask_for_shipping_address: false,
      merchant_support_email: checkoutData.supportEmail || 'support@radarnotes.com',
      pre_populate_buyer_email: checkoutData.buyerEmail,
      pre_populate_shipping_address: {
        first_name: checkoutData.firstName,
        last_name: checkoutData.lastName
      },
      redirect_url: checkoutData.redirectUrl || 'http://localhost:3000/payment/success',
      order: {
        location_id: await this.getLocationId(),
        line_items: checkoutData.items.map(item => ({
          name: item.name,
          quantity: item.quantity.toString(),
          base_price_money: {
            amount: item.price,
            currency: 'USD'
          }
        }))
      }
    };

    const response = await axios.post(`${this.baseUrl}/online-checkout/payment-links`, data, { headers: this.headers });
    return response.data;
  }

  // Utility methods
  async getLocationId() {
    if (this.locationId) return this.locationId;

    const response = await axios.get(`${this.baseUrl}/locations`, { headers: this.headers });
    const locations = response.data.locations;
    
    if (locations && locations.length > 0) {
      this.locationId = locations[0].id;
      return this.locationId;
    }
    
    throw new Error('No Square location found');
  }

  generateIdempotencyKey() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  generateInvoiceNumber() {
    return 'RADAR-' + Date.now().toString();
  }

  // Export transaction data for compatibility
  formatTransactionForExport(payment) {
    return {
      id: payment.id,
      amount: payment.amount_money.amount / 100, // Convert from cents
      currency: payment.amount_money.currency,
      status: payment.status,
      created_at: payment.created_at,
      updated_at: payment.updated_at,
      receipt_number: payment.receipt_number,
      reference_id: payment.reference_id,
      note: payment.note,
      source_type: payment.source_type,
      customer_id: payment.customer_id
    };
  }

  async exportTransactions(beginTime, endTime, format = 'json') {
    const payments = await this.getPayments(beginTime, endTime);
    const transactions = payments.payments.map(p => this.formatTransactionForExport(p));

    switch (format) {
      case 'csv':
        return this.convertToCSV(transactions);
      case 'json':
        return JSON.stringify(transactions, null, 2);
      default:
        return transactions;
    }
  }

  convertToCSV(transactions) {
    if (transactions.length === 0) return '';

    const headers = Object.keys(transactions[0]);
    const csvContent = [
      headers.join(','),
      ...transactions.map(row => 
        headers.map(header => 
          typeof row[header] === 'string' ? `"${row[header]}"` : row[header]
        ).join(',')
      )
    ].join('\n');

    return csvContent;
  }
}

module.exports = SquareIntegration;