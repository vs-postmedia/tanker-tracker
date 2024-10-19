import 'dotenv/config';
// import aisHub from './scripts/aishub.js';
import aisStream from './scripts/aisstream.js';
import getShipDetails from './scripts/get-ship-details.js';

// VARS
const runtime = 5; // how long websocket will stay open, in minutes
// const shipDataFilepath = './data/ships-data.csv'; // main data file
const aisWs = 'wss://stream.aisstream.io/v0/stream'; // AISStream websocket
const aishubUrl = 'https://data.aishub.net/ws.php'; // AISHub URL frag

const data = [
    {"ImoNumber":9374507,"MMSI":636013897,"date":"2024-06-26"},
    {"ImoNumber":9470131,"MMSI":538006204,"date":"2024-08-26"},
	{"ImoNumber":9829095,"MMSI":538006204,"date":"2024-08-18"}
];

async function init() {
	console.log(`Node version: ${process.version}`);
	const aisApiKey = process.env.API_KEY_AISSTREAM;
	// const aishubApiKey = process.env.API_KEY_AISHUB;
	
	// open streams
	aisStream.init(aisWs, aisApiKey, runtime);
	// aisHub.init(aishubUrl, aishubApiKey)

	// getShipDetails.init(data);
}

// kick isht off!!!
init();