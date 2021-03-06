const puppeteer = require("puppeteer");
const commander = require("commander");
const path = require("path");
const mkdirp = require("mkdirp");
const host = "localhost:9991";
const options = {};

commander
    .arguments('<integration> <message_id>')
    .action((integration, messageId) => {
        options.integration = integration;
        options.messageId = messageId;
        console.log(`Capturing screenshot for ${integration} using message ${messageId}`);
    })
    .parse(process.argv);

if (options.integration === undefined) {
    console.error('no integration specified!');
    process.exit(1);
}

// TODO: Refactor to share code with frontend_tests/puppeteer_tests/00-realm-creation.js
async function run() {
    const browser = await puppeteer.launch({
        args: [
            '--window-size=1400,1024',
            '--no-sandbox', '--disable-setuid-sandbox',
            // Helps render fonts correctly on Ubuntu: https://github.com/puppeteer/puppeteer/issues/661
            '--font-render-hinting=none',
        ],
        defaultViewport: null,
        headless: true,
    });
    try {
        const page = await browser.newPage();
        // deviceScaleFactor:2 gives better quality screenshots (higher pixel density)
        await page.setViewport({ width: 1280, height: 1024, deviceScaleFactor: 2 });
        await page.goto('http://' + host);
        // wait for devlogin admin button and click on it
        await page.waitForSelector('.btn-admin');
        await page.click('.btn-admin');

        // Navigate to message and capture screenshot
        await page.goto(`http://${host}/#narrow/near/${options.messageId}`);
        const messageSelector = `#zfilt${options.messageId}`;
        await page.waitForSelector(messageSelector);
        // remove unread marker and don't select message
        const marker = `#zfilt${options.messageId} .unread_marker`;
        await page.evaluate((sel) => $(sel).remove(), marker);  // eslint-disable-line no-undef
        await page.evaluate(() => navigate.up());  // eslint-disable-line no-undef
        const messageBox = await page.$(messageSelector);
        const messageGroup = (await messageBox.$x('..'))[0];
        // Compute screenshot area, with some padding around the message group
        const clip = Object.assign({}, await messageGroup.boundingBox());
        clip.y -= 5;
        clip.x -= 5;
        clip.width += 10;
        clip.height += 10;
        const imageDir = path.join(__dirname, '..', 'static', 'images', 'integrations', options.integration);
        mkdirp.sync(imageDir);
        const imagePath = path.join(imageDir, '001.png');
        await page.screenshot({ path: imagePath, clip: clip });
        console.log(`Screenshot captured to: \x1B[1;31m${imagePath}\n`);
    } catch (e) {
        console.log(e);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

run();
