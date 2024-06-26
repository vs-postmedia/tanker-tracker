import 'dotenv/config';
import aisStream from './scripts/aisstream.js';
import { point, polygon } from '@turf/helpers';
// import booleanPointInPolygon from '@turf/boolean-point-in-polygon';

const aisWs = 'wss://stream.aisstream.io/v0/stream'; // AISStream websocket
// const osUrl = 'https://ais.marineplan.com/location/2/locations.json?'; // open ship url

async function init() {
	//
	const aisApiKey = process.env.API_KEY_AISSTREAM;
	// const suncorApiKey = process.env.API_KEY_SUNCORE;
	
	// open streams
	aisStream.init(aisWs, aisApiKey, zones.westridge);
	// openship(os_url);
}

// kick isht off!!!
init();
