import 'dotenv/config';
import puppeteer from 'puppeteer';


// data
const emailId = 'home-login';
const passId = 'home-password';
const equasisUrl = 'https://www.equasis.org/EquasisWeb/public/HomePage?fs=HomePage';
const userAgent =
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36';

async function init(data) {
    console.log(data)

    // get the password
    const password = process.env.PASS_EQUASIS;

    // search the site
    searchEquasis(data, password);
}

async function searchEquasis(data, password) {
    // Launch the browser and open a new blank page
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.setUserAgent(userAgent);
    
    // Navigate the page to a URL
    await page.goto(equasisUrl, {waitUntil: 'networkidle2'});

    // Set screen size.
    await page.setViewport({width: 1080, height: 1024});

    // Wait for login elements to appear on the page.
    await page.waitForSelector('#home-login');

    // Type a username into the "username" input field with a 100ms delay between key presses.
    await page.type('#home-login', 'ngriffiths@postmedia.com', { delay: 50 });

    // Type a password into the "password" input field with a 100ms delay between key presses.
    await page.type('#home-password', password, { delay: 50 });

    // Click the login button
    await page.click('.pull-right.btn.btn-lg.gris-bleu-copyright');

    // Wait for search box to appear
    await page.waitForSelector('#P_ENTREE_HOME');

    // Type an IMO number into the "imo" input field with a 100ms delay between key presses.
    await page.type('#P_ENTREE_HOME', data.ImoNumber.toString(), { delay: 75 });

    // Click the search button
    await page.click('.btn.btn-default');

    // find & click the link matching the IMO number
    const imoSelector = `a[onclick*="${data.ImoNumber}"]`;
    await page.waitForSelector(imoSelector);
    await page.click(imoSelector);

    // find & click the inspections tab
    const inspectionSelector = 'button[onclick*="ShipInspection?fs=ShipInfo"]';
    await page.waitForSelector(inspectionSelector);
    await page.click(inspectionSelector);

    // collect inspection data
    // const details = await getShipDetails(page, data.ImoNumber);
    const inspectionData = await getInspectionData(page, data.ImoNumber);

    console.log(inspectionData)
}

// UNUSED
async function getShipDetails(page) {
    const details = await page.evaluate(() => {
        const infoElem = document.querySelector('.info-details .access-body')
    })
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

            // console.log(results)

            // backfill data for columns that take up two rows
            if (results.length > 9) {
                finalResults = results;
                rowCache = results.slice(0, 4);
            } else {
                finalResults = [...rowCache, ...results];
            }

            return finalResults
        });
    });

    // prepend IMO number
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