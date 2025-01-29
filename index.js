import 'dotenv/config';
// import aisHub from './scripts/aishub.js';
import aisStream from './scripts/aisstream.js';
import getShipDetails from './scripts/get-ship-details.js';


// VARS
const runtime = 45; // how long websocket will stay open, in minutes
// const shipDataFilepath = './data/ships-data.csv'; // main data file
const aisWs = 'wss://stream.aisstream.io/v0/stream'; // AISStream websocket
// const aishubUrl = 'https://data.aishub.net/ws.php'; // AISHub URL frag


// TEMP //
import fs from 'fs';
import Papa from 'papaparse';
import { tidy, leftJoin } from '@tidyjs/tidy';
import saveData from './scripts/save-data.js';
const shipInfoFilepath = './data/ship-info-data'
import flagLookup from './data/country-flags.js';


async function init() {
	console.log(`Node version: ${process.version}`);
	const aisApiKey = process.env.API_KEY_AISSTREAM;
	// const aishubApiKey = process.env.API_KEY_AISHUB;
	
	// open stream
	// aisStream.init(aisWs, aisApiKey, runtime);
	
	
	// DON"T NEED? //
	// aisHub.init(aishubUrl, aishubApiKey)
	// getShipDetails.init(data);


	// run summary stats
	const shipsUnique = await fetchShipData('./data/output/ships-unique.csv');
	// get the top x IMOs & fetch details from equasis
	const topImos = shipsUnique.sort((a,b) => b.count - a.count).slice(0,2);
	
	// NEED TO HAVE A TRY/CATCH BLOCK HERE
	// get ship details for ships that moor most often
	const equasisResults = await getShipDetails.init(topImos);

	// const inspectionData = equasisResults.map(d => d.inspection_data);
	
	// merge topImos back into shipDetails to get the moorings count
	// const shipDetailsMerged = tidy(
	// 	shipInfo,
	// 	leftJoin(topImos, {by: ['ImoNumber']})
	// );
	
	console.log(equasisResults)

	// // save to disk
	await saveData(equasisResults.ship_info, { filepath: shipInfoFilepath, format: 'csv', append: false });
}

// kick isht off!!!
init();


// TMP //
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