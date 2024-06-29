import 'dotenv/config';
import puppeteer from 'puppeteer';
import saveData from './save-data.js';

// VARS
let browser;
const emailId = 'home-login';
const passId = 'home-password';
const inspectionDataFilepath = './data/inspection-data';
const equasisUrl = 'https://www.equasis.org/EquasisWeb/public/HomePage?fs=HomePage';
const userAgent =
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36';

async function init(data) {
    console.log(data)

    // get equasis password
    const password = process.env.PASS_EQUASIS;

    // initial browser setup
    const page = await setupPage(equasisUrl);

    // search the site
    const inspectionData = await searchEquasis(page, data, password);
    console.log(inspectionData);
    saveData(inspectionData, inspectionDataFilepath, 'csv');

    // close browser
    // await browser.close();
}

async function setupPage(url) {
    // Launch the browser and open a new blank page
    browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.setUserAgent(userAgent);

    // Navigate the page to a URL
    await page.goto(url, {waitUntil: 'networkidle2'});

    // Set screen size.
    await page.setViewport({width: 1080, height: 1024});

    return page;
}

async function searchEquasis(page, data, password) {
    // Wait for login elements to appear on the page.
    await page.waitForSelector('#home-login');

    // Type a username into the "username" input field with a delay between key presses.
    await page.type('#home-login', 'ngriffiths@postmedia.com', { delay: 50 });

    // Type a password into the "password" input field with a delay between key presses.
    await page.type('#home-password', password, { delay: 50 });

    // Click the login button
    await page.click('.pull-right.btn.btn-lg.gris-bleu-copyright');

    // Wait for search box to appear
    await page.waitForSelector('#P_ENTREE_HOME');

    // Type an IMO number into the "imo" input field with a delay between key presses.
    await page.type('#P_ENTREE_HOME', data.ImoNumber.toString(), { delay: 75 });

    // Click the search button
    await page.click('.btn.btn-default');

    // find & click the link matching the IMO number
    const imoSelector = `a[onclick*="${data.ImoNumber}"]`;
    await page.waitForSelector(imoSelector);
    await page.click(imoSelector);

    // find & click the inspections tab
    try {
        const inspectionSelector = 'button[onclick*="ShipInspection?fs=ShipInfo"]';
        await page.waitForSelector(inspectionSelector);
        await Promise.all([
            await page.click(inspectionSelector),
            
            // don't understand why this generates an error? but works as long as error is caught
            page.waitForNavigation({ timeout: 5000 })
        ]);
    } catch (error) {
        // console.log(error);
    }

    // collect inspection data
    let inspectionData = await getInspectionData(page, data.ImoNumber);
    // drop header row
    inspectionData.shift();

    // console.log(inspectionData)
    return inspectionData;
}

async function getInspectionData(page, imo) {

    const inspectionData = await page.evaluate(() => {
        let rowCache = [];
        const table = document.querySelector('.tableLSDD');
        const rows = Array.from(table.querySelectorAll('tr'));

        return rows.map(row => {
            let finalResults = [];
            const cells = Array.from(row.querySelectorAll('td, th'));
            const results = cells.map(cell => cell.textContent.trim());

            // backfill data for columns that take up two rows
            if (results.length > 5) {
                finalResults = results;
                rowCache = results.slice(0, 4);
            } else {
                // console.log(`ROW CACHE: ${rowCache}`)
                finalResults = [...rowCache, ...results];
            }
            console.log(finalResults)

            // does ship have deficiencies?
            if (finalResults[7].length > 0) {
                // follow link to get deficiency details

            } else {
                // fill with NAs
            }

            return finalResults
        });
    });

    // prepend IMO number to each row
    inspectionData.forEach((d, i) => {
        if (i > 0) {
            d.unshift(imo)
        } else {
            d.unshift('Imo number')
        }
    });

    // console.log(inspectionData)

    return inspectionData;
}


export default { init };