const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(bodyParser.json());

// Load environment variables for Authorize.Net credentials
const {
  AUTH_NET_API_LOGIN_ID,
  AUTH_NET_TRANSACTION_KEY,
  AUTH_NET_ENVIRONMENT, // 'sandbox' or 'production'
  SERVER_PORT = 3000,
} = process.env;

if (!AUTH_NET_API_LOGIN_ID || !AUTH_NET_TRANSACTION_KEY || !AUTH_NET_ENVIRONMENT) {
  console.error('Please set AUTH_NET_API_LOGIN_ID, AUTH_NET_TRANSACTION_KEY, and AUTH_NET_ENVIRONMENT environment variables.');
  process.exit(1);
}

const AUTH_NET_API_URL =
  AUTH_NET_ENVIRONMENT === 'production'
    ? 'https://api.authorize.net/xml/v1/request.api'
    : 'https://apitest.authorize.net/xml/v1/request.api';

// Helper function to create a merchantAuthentication object
function getMerchantAuthentication() {
  return {
    name: AUTH_NET_API_LOGIN_ID,
    transactionKey: AUTH_NET_TRANSACTION_KEY,
  };
}

// Endpoint to get Accept Hosted payment form token
app.post('/api/getAcceptHostedToken', async (req, res) => {
  try {
    const { subscriptionInterval } = req.body; // 'monthly' or 'bimonthly'

    if (!subscriptionInterval || !['monthly', 'bimonthly'].includes(subscriptionInterval)) {
      return res.status(400).json({ error: 'Invalid subscriptionInterval. Must be "monthly" or "bimonthly".' });
    }

    // Create ARB subscription request object with placeholder data
    const intervalLength = subscriptionInterval === 'monthly' ? 1 : 2;

    const arbSubscription = {
      name: 'BigCommerce Subscription',
      paymentSchedule: {
        interval: {
          length: intervalLength,
          unit: 'months',
        },
        startDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        totalOccurrences: 9999,
      },
      amount: 0, // Actual amount will be set after payment method is collected
      payment: {
        creditCard: {
          cardNumber: '4111111111111111', // Placeholder, will be replaced by Accept Hosted
          expirationDate: '2025-12', // Placeholder
        },
      },
      customer: {
        id: crypto.randomUUID(),
        email: 'customer@example.com',
      },
      billTo: {
        firstName: 'First',
        lastName: 'Last',
      },
    };

    // Create getHostedPaymentPageRequest payload
    const payload = {
      getHostedPaymentPageRequest: {
        merchantAuthentication: getMerchantAuthentication(),
        transactionRequest: {
          transactionType: 'authCaptureTransaction',
          amount: '0', // Amount 0 here, actual amount handled in subscription
        },
        hostedPaymentSettings: {
          setting: [
            {
              settingName: 'hostedPaymentReturnOptions',
              settingValue: JSON.stringify({
                showReceipt: false,
                url: 'https://yourdomain.com/payment-success',
                urlText: 'Continue',
                cancelUrl: 'https://yourdomain.com/payment-cancel',
                cancelUrlText: 'Cancel',
              }),
            },
            {
              settingName: 'hostedPaymentButtonOptions',
              settingValue: JSON.stringify({
                text: 'Subscribe',
              }),
            },
            {
              settingName: 'hostedPaymentOrderOptions',
              settingValue: JSON.stringify({
                show: false,
              }),
            },
            {
              settingName: 'hostedPaymentPaymentOptions',
              settingValue: JSON.stringify({
                cardCodeRequired: true,
              }),
            },
          ],
        },
      },
    };

    // Call Authorize.Net API to get token
    const response = await axios.post(AUTH_NET_API_URL, payload, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.data.messages.resultCode !== 'Ok') {
      return res.status(500).json({ error: 'Failed to get Accept Hosted token', details: response.data.messages.message });
    }

    const token = response.data.token;

    res.json({ token });
  } catch (error) {
    console.error('Error in /api/getAcceptHostedToken:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Webhook endpoint to handle subscription events (to be implemented)
app.post('/api/webhook', (req, res) => {
  // Handle webhook events from Authorize.Net here
  console.log('Webhook received:', req.body);
  res.status(200).send('OK');
});

app.listen(SERVER_PORT, () => {
  console.log(`Server running on port ${SERVER_PORT}`);
});
