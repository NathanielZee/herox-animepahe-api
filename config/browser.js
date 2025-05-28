const getBrowserConfig = () => ({
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
    ],
    headless: true,
    ignoreHTTPSErrors: true
});

module.exports = { getBrowserConfig };