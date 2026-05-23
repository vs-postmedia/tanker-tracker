import 'dotenv/config';
import aisStream from './scripts/aisstream.js';


// VARS
const runtime = 2; // how long websocket will stay open, in minutes
const ships_data_filepath = './data/ships-data';
const aisWs = 'wss://stream.aisstream.io/v0/stream'; // AISStream websocket


async function init() {
	console.log(`Node version: ${process.version}`);
	const aisApiKey = process.env.API_KEY_AISSTREAM;
	
	// open stream
	await aisStream.init(aisWs, aisApiKey, runtime);
}

// kick isht off!!!
init();

