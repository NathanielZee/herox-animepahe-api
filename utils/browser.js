const fs = require('fs/promises');
const path = require('path');
const { existsSync } = require('fs');
const os = require('os');

let chromiumBinary = null;
let chromium = null;
let useServerlessChromium = false;

try {
    // Load serverless-compatible Chromium and core browser
    chromiumBinary = require('@sparticuz/chromium');
    chromium = require('playwright-core').chromium;

    // Only use if running on Linux (e.g. serverless)
    if (os.platform() === 'linux') {
        useServerlessChromium = true;
    } else {
        console.warn('⚠️ Detected non-Linux OS. Disabling @sparticuz/chromium for local dev.');
    }
} catch (e) {
    // Fallback to full Playwright (e.g. local dev)
    console.warn('Falling back to full Playwright (probably running locally)');
    chromium = require('playwright').chromium;
}

/**
 * Launches a Chromium browser with appropriate settings for the current environment.
 * Automatically supports both serverless and local development.
 */
async function launchBrowser() {
    const launchOptions = {
        headless: true,
        args: [],
    };

    if (useServerlessChromium && chromiumBinary) {
        const executablePath = await chromiumBinary.executablePath();

        if (existsSync(executablePath)) {
            launchOptions.executablePath = executablePath;
            launchOptions.args = chromiumBinary.args;
        } else {
            console.warn('⚠️ Chromium binary not found at expected path. Falling back to default.');
        }
    }

    return await chromium.launch(launchOptions);
}

module.exports = { launchBrowser };
