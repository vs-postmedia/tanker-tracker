import fs from 'fs';
 import 'dotenv/config';
import Papa from 'papaparse';
import aisStream from './scripts/aisstream.js';
import generateSummaryStats from './scripts/generate-summary-stats.js';

// VARS
const shipdataFilepath = './data/ships-data.csv';
const aisWs = 'wss://stream.aisstream.io/v0/stream'; // AISStream websocket
// const osUrl = 'https://ais.marineplan.com/location/2/locations.json?'; // open ship url

async function init() {
	const aisApiKey = process.env.API_KEY_AISSTREAM;
	
	// open streams
	aisStream.init(aisWs, aisApiKey);
	// openship(os_url);

	// run summary stats
	// const data = await fetchShipData(shipdataFilepath);
	// generateSummaryStats(data);
}

async function fetchShipData(filepath) {
	let data;
    // read in the master csvfile
    const file = fs.readFileSync(filepath, 'utf8');

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

// kick isht off!!!
init();
