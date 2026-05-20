const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors({
    origin: '*'
}));
app.use(express.json());

app.use(morgan('dev'));

app.use('/auth', require('./routes/auth'));
app.use('/api/portfolio', require('./routes/portfolio'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/analysis', require('./routes/analysis'));
app.use('/api/outreach', require('./routes/outreach'));
app.use('/api/chronos', require('./routes/chronos'));

app.use((req, res, next) => {
    res.status(404).json({
        status: 'error',
        message: 'Route not found'
    });
});

app.use(errorHandler);

app.listen(config.port, () => {
    console.log(`[PCOP Server] Listening on port ${config.port}`);
    console.log(`[PCOP Server] Bank API URL: ${config.bankApiBaseUrl}`);
});
