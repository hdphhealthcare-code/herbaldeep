
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');

const { clientUrl } = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

// Security
app.use(helmet());

// Compression
app.use(compression());

// CORS Configuration
const allowedOrigins = [
  'https://herbaldeep.vercel.app',
  ...clientUrl.split(',').map(url => url.trim()).filter(Boolean)
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  },
  credentials: true
}));

// Body Parser
app.use(express.json({ limit: '1mb' }));

// Logger
app.use(
  morgan(
    process.env.NODE_ENV === 'production' ? 'tiny' : 'dev'
  )
);

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API Routes
app.use('/api', routes);

// Error Handling
app.use(notFound);
app.use(errorHandler);

module.exports = app;
