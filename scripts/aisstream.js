import WebSocket from 'ws';
import winston from 'winston';
import saveData from './save-data.js';
import { point, polygon } from '@turf/helpers';
// import { postToTwitter } from './post-online.js';
import generateSummaryStats from './generate-summary-stats.js';
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

async function aisStream(url, apiKey, bbox) {
	socket = new WebSocket(url);

	// create polygons for terminal
	suncor_poly = polygon([zones.suncor]);
	westridge_poly = polygon([zones.westridge]);
	// ebay_poly = polygon([zones.englishbay]);


	socket.addEventListener('open', _ => {
		// setup websocket request
		const subscriptionMsg = {
			APIkey: apiKey,
			BoundingBoxes: [
				// Westridge Terminal
				[zones.westridge[0], zones.westridge[2]],
				
				// Suncor Terminal
				[zones.suncor[0], zones.suncor[2]]

				// English Bay
				// zones.englishbay[0], zones.englishbay[2]
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
	
	// on socket close
	socket.addEventListener('close', (e) => {
		console.log(`WebSocket connection closed, code: ${e.code}`);
		exitScript();
	});

	// error msg
	socket.addEventListener('error', (e) => {
		console.log(`Socket setup failed: ${JSON.parse(e)}`);
		exitScript();
	});

	// on message rx
	socket.addEventListener('message', (e) => {
		let aisMessage = JSON.parse(e.data);

			// check for ships currently moored
			if (aisMessage.MessageType === 'PositionReport') {
				// cache currently moored ships
				// getCurrentShips(aisMessage);
			}

		// get static ship data on ships in bboxes
		if (aisMessage.MessageType === 'ShipStaticData') {
			console.log(`SSD: ${aisMessage.Message.ShipStaticData.Type}, ${aisMessage.Message.ShipStaticData.Name}`);

			// check ship type
			if (ship_types.includes(aisMessage.Message.ShipStaticData.Type)) {
				getShipStaticData(aisMessage);
			}
		}
	});
}

// calculate length/width of ship
function calculateShipDimensions(data) {
	return `${data.A + data.B}:${data.C + data.D}`;
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

// shut ’er down!
function exitScript() {
	// close websocket
	socket.close();

	console.log(`Shutting down script run: ${new Date()}`);
	// logger.info(`Shutting down script run: ${new Date()}`);
	
	// exit script
	process.exit(0);
}

// get currentShipPositions
async function getCurrentShips(aisMessage) {
	const metaData = aisMessage.MetaData;
	const positionData = aisMessage.Message.PositionReport;

	console.log(aisMessage)
	console.log(`GCS: ${metaData.ShipName.trim()}, ${positionData.NavigationalStatus}`);

	// check navstatus to see if ship is moored or at anchor
	// https://datalastic.com/blog/ais-navigational-status/
	// if (positionData.NavigationalStatus === 1 || positionData.NavigationalStatus === 5) {
		// get mmsi number
		let mmsi = metaData.MMSI;
		let shipMoored = current_ships_cache.some(d => d.MMSI === mmsi);
		// console.log(`Moored: ${shipMoored}`)

		// if mmsi isn't cached as currently moored, do so.
		if (shipMoored === undefined) {
			// determine terminal
			// data.terminal = getTerminal(aisMessage);
			// data.ShipName = data.ShipName.trim();
			// current_ships_cache.push({imo: imo, terminal: terminal});
			current_ships_cache.push(mmsi);

			console.log(JSON.stringify(current_ships_cache))

			// save to current ships cache
			// await saveData(current_ships_cache, { filepath: current_ships_filepath, format: 'json', append: false });
			
			// post announcement to social media
			// postToTwitter(data);
		}
	// }
}

// staticshipdata includes imo, mmsi, ship type, size, etc
async function getShipStaticData(aisMessage) {
	let data = aisMessage.Message.ShipStaticData;

	// timestamp to local ymd format
	const timestamp = aisMessage.MetaData.time_utc;
	const date = new Date(timestamp);
	data.date = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
	// create array from Eta
	const timeArray = `${data.Eta.Day},${data.Eta.Hour},${data.Eta.Minute},${data.Eta.Month},${date.getFullYear()}`;


	// if new IMO or same IMO with new ETA, update cache 
	let new_imo = ships_list.some(d => d.ImoNumber === data.ImoNumber);
	let new_eta = ships_list.some(d => d.Eta ? d.Eta === timeArray : undefined);

	console.log(`IMO exists: ${new_imo}`);
	console.log(`ETA exists: ${new_eta}, ${data.Eta}`);

	// console.log(data)
	// generateSummaryStats([data])

	if (new_imo === false || (new_imo === true && new_eta == false)) {
		console.log(`New ship in boundary: ${aisMessage.MetaData.ShipName}`);

		// trim whitespace from strings
		data.CallSign = data.CallSign.trim();
		data.Destination = data.Destination.trim();
		data.Dimension = calculateShipDimensions(data.Dimension);
		data.Eta = timeArray;
		data.Name = data.Name.trim();
		// get mmsi & arrival date
		data.MMSI = aisMessage.MetaData.MMSI;
		data.time_utc = timestamp;
		// determine terminal
		data.terminal = getTerminal(aisMessage);
		
		// update ships_data array & save full ship data to disk
		await saveData([data], { filepath: ships_data_filepath, format: 'csv', append: true });

		// save data to use for a lookup (using object destructuring)
		updateLookupTable(data);
		await saveData(ships_list, { filepath: ships_lookup_filepath, format: 'json', append: false })

		// run summary stats
		generateSummaryStats([data]);
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
	// } else if (booleanPointInPolygon(point, ebay_poly)) {
	// 	terminal = 'English Bay'
	}

	if (terminal == undefined) {
		console.log(`Terminal undefined:`)
		console.log(point)
		console.log(suncor_poly)
	}

	return terminal;
}

// update a ship lookup table with imo, mmsi & eta from the full dataset
function updateLookupTable(data) {
	let lookup = (({ImoNumber, MMSI, Eta}) => ({ImoNumber, MMSI, Eta}))(data);
	ships_list.push(lookup);
}

async function init(url, apiKey, bbox) {
	// setup logging
	logger = await createLogger(static_ships_log_filepath, 'info');

	console.log(`Starting new script run: ${new Date()}`);
	logger.info(`Starting new script run: ${new Date()}`);

	// start web socket to aisstream
	aisStream(url, apiKey, bbox);

	// convert runtime to ms
	const streamDuration = (runtime * 60) * 1000;

	// close the stream after `streamDuration` minutes
	setTimeout(exitScript, streamDuration);
}

// kick isht off!!!
export default { init };