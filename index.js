import 'dotenv/config';
import aisStream from './scripts/aisstream.js';

// VARS
const runtime = 30; // how long websocket will stay open, in minutes
const shipdataFilepath = './data/ships-data.csv'; // main data file
const aisWs = 'wss://stream.aisstream.io/v0/stream'; // AISStream websocket

async function init() {
	const aisApiKey = process.env.API_KEY_AISSTREAM;
	
	// open streams
	aisStream.init(aisWs, aisApiKey, runtime);
}

// kick isht off!!!
init();
