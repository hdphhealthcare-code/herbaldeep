require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  xpressbees: {
    baseUrl: process.env.XPRESSBEES_BASE_URL || 'https://shipment.xpressbees.com/api',
    email: process.env.XPRESSBEES_EMAIL || '',
    password: process.env.XPRESSBEES_PASSWORD || '',
  },
  shipmozo: {
    baseUrl: process.env.SHIPMOZO_BASE_URL || 'https://shipping-api.com/app/api/v1',
    publicKey: process.env.SHIPMOZO_PUBLIC_KEY || '',
    privateKey: process.env.SHIPMOZO_PRIVATE_KEY || '',
  },
  ekart: {
    baseUrl: process.env.EKART_BASE_URL || 'https://app.elite.ekartlogistics.in',
    clientId: process.env.EKART_CLIENT_ID || '',
    username: process.env.EKART_USERNAME || '',
    password: process.env.EKART_PASSWORD || '',
    // Ekart's create-shipment API requires the seller's billing details and GST
    sellerName: process.env.EKART_SELLER_NAME || '',
    sellerAddress: process.env.EKART_SELLER_ADDRESS || '',
    sellerGstTin: process.env.EKART_SELLER_GST_TIN || '',
    gstPercent: Number(process.env.EKART_GST_PERCENT || 0), // used when the order has no invoice yet
    category: process.env.EKART_CATEGORY || 'Healthcare',
    hsnCode: process.env.EKART_HSN_CODE || '',
  },
  // Delhivery (Express / B2C). Token: Delhivery One > Settings > API Setup. Production: https://track.delhivery.com
  // Staging (testing): https://staging-express.delhivery.com
  delhivery: {
    baseUrl: process.env.DELHIVERY_BASE_URL || 'https://track.delhivery.com',
    token: process.env.DELHIVERY_API_TOKEN || '',
    clientName: process.env.DELHIVERY_CLIENT_NAME || '', // optional, only used for rate quotes if Delhivery asks for it
    hsnCode: process.env.DELHIVERY_HSN_CODE || '',
  },
  // Shiprocket (API user created in Shiprocket > Settings > API > Create API User; do not use your main login)
  shiprocket: {
    baseUrl: process.env.SHIPROCKET_BASE_URL || 'https://apiv2.shiprocket.in/v1/external',
    email: process.env.SHIPROCKET_EMAIL || '',
    password: process.env.SHIPROCKET_PASSWORD || '',
    pickupEmail: process.env.SHIPROCKET_PICKUP_EMAIL || '', // contact email for new pickup addresses (default: the login email)
    customerEmail: process.env.SHIPROCKET_CUSTOMER_EMAIL || '', // Shiprocket insists on an email: used when the customer has none
    hsnCode: process.env.SHIPROCKET_HSN_CODE || '',
  },
  // Live status: how often the server asks the couriers about booked shipments (seconds)
  tracking: {
    enabled: String(process.env.TRACKING_SYNC_ENABLED || 'true').toLowerCase() !== 'false',
    intervalMs: Math.max(Number(process.env.TRACKING_SYNC_INTERVAL_SEC || 120), 30) * 1000,
    minAgeMs: Math.max(Number(process.env.TRACKING_MIN_AGE_SEC || 60), 10) * 1000, // do not re-check a shipment more often than this
  },
  // Shared secret for courier webhooks: POST /api/webhooks/<courier>?token=<secret>. Empty = webhooks disabled.
  webhookSecret: process.env.WEBHOOK_SECRET || '',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
};
