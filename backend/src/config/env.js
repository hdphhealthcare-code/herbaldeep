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
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
};
