import WebSocket from 'ws';
import winston from 'winston';
import saveData from './save-data.js';
import { point, polygon } from '@turf/helpers';
// import { postToTwitter } from './post-online.js';
// import generateSummaryStats from './generate-summary-stats.js';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';

// DATA
import zones from '../data/zone-coords.json' assert { type: 'json' };
import ships_list from '../data/ships-list.json' assert { type: 'json' };
import current_ships from '../data/current-ships.json' assert { type: 'json' };
// const ships_data = require('../data/ships-data.json');

// VARS
let logger, socket;
let ships_list_lookup = [];
let current_ships_cache = [];
let ebay_poly, suncor_poly, westridge_poly;

const runtime = 30; // how long websocket will stay open, in minutes
const current_ships_interval = 5000;
// https://www.navcen.uscg.gov/sites/default/files/pdf/AIS/AISGuide.pdf
const ship_types = [80, 81, 82, 83, 84, 85, 86, 87, 88, 89]; // 80+ === tanker
// const ship_types = [70, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89]; // 80+ === tanker, 70 === cargo

// FILEPATHS
const ships_data_filepath = './data/ships-data';
const ships_lookup_filepath = './data/ships-list';
const current_ships_filepath = './data/current-ships';
const static_ships_log_filepath = './logs/static-ships.log';

async function aisStream(url, apiKey) {
	socket = new WebSocket(url);

	// create polygons for terminals
	// ebay_poly = polygon([zones.englishbay]);
	// suncor_poly = polygon([zones.suncor]);
	westridge_poly = polygon([zones.westridge]);

	// run summary stats
	// generateSummaryStats();

	socket.addEventListener('open', _ => {
		// setup websocket request
		const subscriptionMsg = {
			APIkey: apiKey,
			BoundingBoxes: [
				[				
					// English Bay
					// zones.englishbay[0], zones.englishbay[2]
					
					// Suncor Terminal
					// zones.suncor[0], zones.suncor[2]
					// [zones.suncor[0], zones.suncor[1], zones.suncor[2], zones.suncor[3]],

					// Westridge Terminal
					zones.westridge[0], zones.westridge[2]
					// zones.westridge[0], zones.westridge[1], zones.westridge[2], zones.westridge[3]

					// westridge & suncor
					// zones.westridge[0], zones.suncor[1], zones.suncor[2], zones.westridge[3]
				]
			],
			FilterMessageTypes: ['PositionReport', 'ShipStaticData']
		};

		// console.log(JSON.stringify(subscriptionMsg));
		
		// open AISstream websocket
		socket.send(JSON.stringify(subscriptionMsg));

		// save the current ships cache to disk every xxx minutes
		setInterval(() => {
			// saveData(current_ships_cache, current_ships_filepath, 'json');
		}, current_ships_interval);
	});

	// error msg
	socket.addEventListener('error', (e) => {
		console.error(e);
		logger.err(`Socket setup failed: ${JSON.parse(e)}`);
	});

	socket.addEventListener('message', (e) => {
		let aisMessage = JSON.parse(e.data);

		// get static ship data on ships in bboxes
		if (aisMessage.MessageType === 'ShipStaticData') {
			// console.log(aisMessage.Message.ShipStaticData.Type)
			// check ship type
			if (ship_types.includes(aisMessage.Message.ShipStaticData.Type)) {
				getShipStaticData(aisMessage);
			}
		}

		// check for moored or moving ships
		if (aisMessage.MessageType === 'PositionReport') {
			// cache currently moored ships
			getCurrentShips(aisMessage);
		}
	});

	socket.addEventListener('close', () => {
		console.log('WebSocket connection closed.');
	});
}

// setup logging
async function createLogger(logfile, level) {
	return winston.createLogger({
		level: level,
		format: winston.format.combine(
			winston.format.timestamp(),
			winston.format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`)
		),
		transports: [
			new winston.transports.Console(),
			new winston.transports.File({ filename: logfile })
		]
	});
}

function exitScript() {
	// close websocket
	socket.close();

	console.log(`Shutting down script run: ${new Date()}`);
	logger.info(`Shutting down script run: ${new Date()}`);
	
	// exit script
	process.exit(0);
}

// get currentShipPositions
async function getCurrentShips(aisMessage) {
	let data = aisMessage.MetaData;

	console.log(`getCurrentShips: ${data.ShipName}`);
	// console.log(aisMessage)

	// check navstatus to see if ship is moored or at anchor
	// https://datalastic.com/blog/ais-navigational-status/
	if (data.NavigationalStatus === 1 || data.NavigationalStatus === 5) {
		// get mmsi number
		let mmsi = data.MMSI;

		// if mmsi isn't cached as currently moored, do so.
		if (current_ships_cache.find(d => d.MMSI === mmsi) === undefined) {
			// determine terminal
			data.terminal = getTerminal(aisMessage);
			data.ShipName = data.ShipName.trim();
			current_ships_cache.push(mmsi);
			
			// post announcement to social media
			// postToTwitter(data);
		}
	}
}

// staticshipdata includes imo, mmsi, ship type, size, etc
async function getShipStaticData(aisMessage) {
	let data = aisMessage.Message.ShipStaticData;

	console.log(`${aisMessage.MessageType}: ${aisMessage.MetaData.ShipName}`);

	// timestamp to local ymd format
	const timestamp = aisMessage.MetaData.time_utc;
	const date = new Date(timestamp);
	data.date = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;

	// if new IMO or same IMO on new date, update cache 
	let new_imo = ships_list.some(d => d.ImoNumber === data.ImoNumber);
	let new_date = ships_list.some(d => d.date.slice(0, -3) === data.date.slice(0, -3));

	console.log(`New IMO: ${new_imo}`)
	console.log(`New Date; ${new_date}, ${data.date.slice(0, -3)}`)

	if (new_imo === false || new_imo === true && new_date === false) {
		logger.info(`New ship in boundary: ${aisMessage.MetaData.ShipName}`);

		// trim whitespace from strings
		data.CallSign = data.CallSign.trim();
		data.Destination = data.Destination.trim();
		data.Name = data.Name.trim();
		// get mmsi & arrival date
		data.MMSI = aisMessage.MetaData.MMSI;
		data.time_utc = timestamp;
		// determine terminal
		data.terminal = getTerminal(aisMessage);
		
		// update ships_data array & save full ship data to disk
		await saveData([data], ships_data_filepath, 'csv');

		// save data to use for a lookup (using object destructuring)
		updateLookupTable(data);
		await saveData(ships_list, ships_lookup_filepath, 'json');

		// run summary stats
		// generateSummaryStats(ships_data);
	}
}

// unused so far...
// async function checkShipDeparture(aisMessage) {
// 	// course over ground (direction of movement)
// 	let cog = aisMessage.Message.PositionReport.Cog;
// 	// speed over ground (<1 seems to be 'stopped')
// 	let sog = aisMessage.Message.PositionReport.Sog;
// 	// https://datalastic.com/blog/ais-navigational-status/
// 	let navstat = aisMessage.Message.PositionReport.NavigationalStatus;
	
// 	if (navstat === 0 && cog > 200 && cog < 338 && sog > 1) {
// 		console.log('headed west!')
// 		console.log(aisMessage);
// 	}
// }

// check if ship lat/lon is inside one of the defined terminal zones
function getTerminal(data) {
	let terminal;

	// ship position
	const point = ([data.MetaData.latitude, data.MetaData.longitude]);
	
	// determine where ship is located
	if (booleanPointInPolygon(point, westridge_poly)) {
		terminal = 'Westridge';
	} else if (booleanPointInPolygon(point, suncor_poly)) {
		terminal = 'Suncor';
	} else if (booleanPointInPolygon(point, ebay_poly)) {
		terminal = 'English Bay'
	}

	if (terminal == undefined) console.log(`Terminal undefined: ${data}`)

	return terminal;
}

// create a ship lookup with imo, mmsi & date
function updateLookupTable(data) {
	let lookup = (({ImoNumber, MMSI, date}) => ({ImoNumber, MMSI, date}))(data);
	ships_list.push(lookup);
}

async function init(url, apiKey) {
	// setup logging
	logger = await createLogger(static_ships_log_filepath, 'info');

	console.log(`Starting new script run: ${new Date()}`);
	logger.info(`Starting new script run: ${new Date()}`);

	// start web socket to aisstream
	aisStream(url, apiKey);

	// convert runtime to ms
	const streamDuration = (runtime * 60) * 1000;

	// close the stream after `streamDuration` minutes
	setTimeout(exitScript, streamDuration);
}

// kick isht off!!!
export default { init };

