const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors({
    origin: '*' // Allow all origins for demo purposes
}));
app.use(express.json());

// Simple logging middleware
app.use(morgan('dev'));

// Mount specific routers
app.use('/api/portfolio', require('./routes/portfolio'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/analysis', require('./routes/analysis'));
app.use('/api/outreach', require('./routes/outreach'));

app.use((req, res, next) => {
    res.status(404).json({
        status: 'error',
        message: 'Route not found'
    });
});

app.use(errorHandler);

app.listen(config.port, () => {
    console.log(`[PCOP Main Server] Listening on port ${config.port}`);
    console.log(`[PCOP Main Server] Demo Server URL: ${config.demoServerUrl}`);
});
