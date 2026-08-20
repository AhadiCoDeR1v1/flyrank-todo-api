const { Inngest } = require('inngest');

// Initialize Inngest client with unique application identifier
// Enabled for local development engine (http://localhost:8288)
const inngest = new Inngest({
    id: 'report-api',
    isDev: true,
    env: {
        INNGEST_DEV: '1'
    }
});

module.exports = { inngest };
