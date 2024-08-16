import 'dotenv/config';
import aisStream from './scripts/aisstream.js';

// VARS
const shipdataFilepath = './data/ships-data.csv';
const aisWs = 'wss://stream.aisstream.io/v0/stream'; // AISStream websocket

async function init() {
	const aisApiKey = process.env.API_KEY_AISSTREAM;
	
	// open streams
	aisStream.init(aisWs, aisApiKey);
}

// kick isht off!!!
init();
