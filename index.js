import 'dotenv/config';
import aisStream from './scripts/aisstream.js';

const aisWs = 'wss://stream.aisstream.io/v0/stream'; // AISStream websocket
// const osUrl = 'https://ais.marineplan.com/location/2/locations.json?'; // open ship url

async function init() {
	const aisApiKey = process.env.API_KEY_AISSTREAM;
	
	// open streams
	aisStream.init(aisWs, aisApiKey);
	// openship(os_url);
}

// kick isht off!!!
init();
