import 'dotenv/config';
import aisStream from './scripts/aisstream.js';
import getShipDetails from './scripts/get-ship-details.js';

// VARS
const runtime = 15; // how long websocket will stay open, in minutes
const shipdataFilepath = './data/ships-data.csv'; // main data file
const aisWs = 'wss://stream.aisstream.io/v0/stream'; // AISStream websocket

const data = [
    {"ImoNumber":9374507,"MMSI":636013897,"date":"2024-06-26"},
    {"ImoNumber":9470131,"MMSI":538006204,"date":"2024-08-26"},
	{"ImoNumber":9829095,"MMSI":538006204,"date":"2024-08-18"}
];

async function init() {
	console.log(process.version)
	const aisApiKey = process.env.API_KEY_AISSTREAM;
	// console.log(`LOGNAME: ${JSON.stringify(process.env.LOGNAME)}`)
	// console.log(`USER: ${JSON.stringify(process.env.USER)}`)
	// console.log(`COMMAND_MODE: ${JSON.stringify(process.env.COMMAND_MODE)}`)
	// console.log(`XPC_SERVICE_NAME: ${JSON.stringify(process.env.XPC_SERVICE_NAME)}`)
	
	// open streams
	aisStream.init(aisWs, aisApiKey, runtime);

	getShipDetails.init(data);
}

// kick isht off!!!
init();
