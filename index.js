import 'dotenv/config';
import aisStream from './scripts/aisstream.js';
import getShipDetails from './scripts/get-ship-details.js';

const aisWs = 'wss://stream.aisstream.io/v0/stream'; // AISStream websocket
// const osUrl = 'https://ais.marineplan.com/location/2/locations.json?'; // open ship url

async function init() {
	const aisApiKey = process.env.API_KEY_AISSTREAM;
	
	// open streams
	// aisStream.init(aisWs, aisApiKey);

	getShipDetails.init({"ImoNumber":9374507,"MMSI":636013897,"date":"2024-06-26"})
}

// kick isht off!!!
init();
