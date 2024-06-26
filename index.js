import 'dotenv/config';
import aisStream from './scripts/aisstream.js';
import generateSummaryStats from './scripts/generate-summary-stats.js';

// VARS
const aisWs = 'wss://stream.aisstream.io/v0/stream'; // AISStream websocket
// const osUrl = 'https://ais.marineplan.com/location/2/locations.json?'; // open ship url

async function init() {
	const aisApiKey = process.env.API_KEY_AISSTREAM;
	
	// open streams
	aisStream.init(aisWs, aisApiKey);
	// openship(os_url);

	// run summary stats
	generateSummaryStats();
}

// kick isht off!!!
init();
