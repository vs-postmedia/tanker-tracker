import fs from 'fs';
import 'dotenv/config';
import Papa from 'papaparse';
import puppeteer from 'puppeteer';
import saveData from './save-data.js';

// VARS
let browser;
const shipData = [];
const shipsToSave = [];
const loginIdSelector = '#home-login';
const passIdSelector = '#home-password';
const loginAddress = process.env.LOGIN_EQUASIS;
const shipInfoFilepath = './data/ship-info-data';
const inspectionDataFilepath = './data/inspection-data';
const isHeadless = process.env.LOGNAME === undefined ? true : false;
const equasisUrl = 'https://www.equasis.org/EquasisWeb/public/HomePage?fs=HomePage';
const userAgent =
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36';
const shipInfoSelector = '#body > section:nth-child(9) > div > div > div.col-lg-8.col-md-8.col-sm-12.col-xs-12 > div:nth-child(2) > div.col-lg-12.col-md-12.col-sm-12.col-xs-12 > div.access-item > div > div > div.col-lg-12.col-md-12.col-sm-12.col-xs-12';

async function init(data) {
    console.log(`DATA: ${JSON.stringify(data)}`);
    console.log(`LOGNAME: ${process.env.LOGNAME}`)
    console.log(`HEADLESS: ${isHeadless}`);

    const storedShipDetails = await fetchStoredShipData(shipInfoFilepath);

    // get equasis password
    const password = process.env.PASS_EQUASIS;

    // initial browser setup
    const page = await setupPage(equasisUrl);

    // login to equasis 
    const loggedInPage = await loginToEquasis(page, password);
    
    // search ship info
    const equasisResults = await fetchShipData(loggedInPage, data);

    const shipInfo = equasisResults.map(d => d.ship_info);
    const inspectionData = equasisResults.map(d => d.inspection_data);

    // if we don't already have the shipinfo, save it
    for (const ship of shipInfo) {
        const shipInfoExists = storedShipDetails.some(d => parseInt(ship.imo_number) === parseInt(d.imo_number));

        if (!shipInfoExists) { shipsToSave.push(ship); }
    };

    // add new ships to our database
    if (shipsToSave.length > 0) {
        await saveData(shipsToSave, { filepath: shipInfoFilepath, format: 'csv', append: true });
    }

    // if there is new inspection data, save it
    // console.log(inspectionData)
    // what's this do??? de-dup? YES // [...new Set(inspectionData)] 
    // console.log(inspectionData.reduce((acc, val) => acc.concat(val), []));
    // const newInspectionData = false;
    // if (!newInspectionData) {
    //     await saveData(inspectionData.reduce((acc, val) => acc.concat(val), []), { filepath: inspectionDataFilepath, format: 'csv', append: true });
    // }

    // close browser
   await browser.close();

   	// exit script
	// process.exit(0);
}

async function fetchStoredShipData(filepath) {
	let data;
    // read in the master csvfile
    const file = fs.readFileSync(`${filepath}.csv`, 'utf8');

    // convert to json
    Papa.parse(file, {
        complete: (response) => {
            // NEEDS ERROR LOG HERE
			data = response.data;
        },
        delimiter: ',',
        header: true
    });
	
	return data;
}

async function fetchShipData(page, data) {
    const shipData = [];

    for (const d of data) {
        const results = await searchEquasis(page, d);
        shipData.push(results);
    }

    return shipData;
}

async function getShipInfo(page, imo, shipInfoSelector) {
    // console.log(shipInfoSelector);
    await page.waitForSelector(shipInfoSelector);
    
    const shipDetails = await page.evaluate((imo, selector) => {
        const table = document.querySelector(selector);
        const rows = Array.from(table.querySelectorAll('.row'));

        // get each 'cell' from each row
        const cells = rows.map(row => Array.from(row.querySelectorAll('.col-xs-6')));

        return {
            imo_number: imo,
            flag: cells[0][3].textContent.trim().replace('(','').replace(')', ''),
            gross_tonnage: parseInt(cells[3][1].textContent.trim()),
            ship_type: cells[5][1].textContent.trim(),
            build_year: cells[6][1].textContent.trim()
        };

    }, imo, shipInfoSelector);

    return shipDetails;
}

async function getInspectionData(page, imo) {
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

    const inspectionData = await page.evaluate(() => {
        let rowCache = [];
        const table = document.querySelector('.tableLSDD');
        const rows = Array.from(table.querySelectorAll('tr'));

        return rows.map(row => {
            let finalResults = [];
            const cells = Array.from(row.querySelectorAll('td, th'));

            console.log(cells)
            const results = cells.map(cell => cell.textContent.trim());

            // backfill data for columns that take up two rows
            if (results.length > 5) {
                finalResults = results;
                rowCache = results.slice(0, 4);
            } else {
                // console.log(`ROW CACHE: ${rowCache}`)
                finalResults = [...rowCache, ...results];
            }

            // create year column
            results.year = parseInt(results[2].slice(-4));
            
            // console.log(finalResults)

            // does ship have deficiencies?
            if (finalResults[7].length > 0) {
                // follow link to get deficiency details
                console.log(finalResults[7])
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

    // drop header row
    inspectionData.shift();

    return inspectionData;
}

async function loginToEquasis(page, password) {
    // Wait for login elements to appear on the page.
    await page.waitForSelector('#home-login');

    // Type a username into the "username" input field with a delay between key presses.
    await page.type(loginIdSelector, loginAddress, { delay: 50 });

    // Type a password into the "password" input field with a delay between key presses.
    await page.type(passIdSelector, password, { delay: 50 });

    // Click the login button
    await page.click('.pull-right.btn.btn-lg.gris-bleu-copyright');

    return page;
}

async function setupPage(url) {
    // Launch the browser and open a new blank page
    /*
    *** use process.env.MODE TO SET HEADLESS VAR BASED ON ENVIRONMENT!!! ***
    */
    browser = await puppeteer.launch({ headless: isHeadless });
    const page = await browser.newPage();
    await page.setUserAgent(userAgent);

    // Navigate the page to a URL
    await page.goto(url, {waitUntil: 'networkidle2'});

    // Set screen size.
    await page.setViewport({width: 1080, height: 1024});

    return page;
}

async function searchEquasis(page, data) {
    console.log(data)
    // go to home page
    await page.click('.navbar-nav a[href*="HomePage"]');

    // Wait for search box to appear
    await page.waitForSelector('#P_ENTREE_HOME');

    // Type an IMO number into the "imo" input field with a delay between key presses.
    await page.type('#P_ENTREE_HOME', data.ImoNumber.toString(), { delay: 75 });

    // Click the search button
    await page.click('.btn.btn-default');

    // find & click the link matching the IMO number
    const imoSelector = `a[onclick*="${data.ImoNumber}"]`;
    await page.waitForSelector(imoSelector);

    // Navigation happens here, so we need to wait for it to complete
    await Promise.all([
        page.click(imoSelector),
        page.waitForNavigation({ waitUntil: 'networkidle0'})
    ]);
    // await page.click(imoSelector);

    // collect ship info
    let shipInfo = await getShipInfo(page, data.ImoNumber, shipInfoSelector);

    // collect inspection data
    let inspectionData = await getInspectionData(page, data.ImoNumber);

    // console.log(inspectionData)
    return {
        ship_info: shipInfo,
        inspection_data: inspectionData
    };
}



export default { init };