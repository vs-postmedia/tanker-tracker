import 'dotenv/config';
// import aisHub from './scripts/aishub.js';
import aisStream from './scripts/aisstream.js';


// VARS
const runtime = 45; // how long websocket will stay open, in minutes
const ships_data_filepath = './data/ships-data';
const aisWs = 'wss://stream.aisstream.io/v0/stream'; // AISStream websocket
// const aishubUrl = 'https://data.aishub.net/ws.php'; // AISHub URL frag




async function init() {
	console.log(`Node version: ${process.version}`);
	const aisApiKey = process.env.API_KEY_AISSTREAM;
	// const aishubApiKey = process.env.API_KEY_AISHUB;
	
	// open stream
	await aisStream.init(aisWs, aisApiKey, runtime);
}

// kick isht off!!!
init();

