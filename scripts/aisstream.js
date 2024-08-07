import WebSocket from 'ws';
import saveData from './save-data.js';
import { point, polygon } from '@turf/helpers';
// import { postToTwitter } from './post-online.js';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';

// DATA
import zones from '../data/zone-coords.json' assert { type: 'json' };
import ships_list from '../data/ships-list.json' assert { type: 'json' };
import current_ships from '../data/current-ships.json' assert { type: 'json' };

// VARS
const runtime = 10; // how long websocket will stay open, in minutes
let socket;
const ships_list_lookup = [];
const current_ships_cache = [];
let ebay_poly, suncor_poly, westridge_poly; 

// https://api.vesselfinder.com/docs/ref-aistypes.html
const ship_types = [9, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89]; // 80+ === tanker, 70 === cargo

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

		console.log(JSON.stringify(subscriptionMsg));
		
		// open AISstream websocket
		socket.send(JSON.stringify(subscriptionMsg));
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
				getCurrentShips(aisMessage);
			}

		// get static ship data on ships in bboxes
		if (aisMessage.MessageType === 'ShipStaticData') {
			// console.log(`SSD: ${aisMessage.Message.ShipStaticData.Type} ${aisMessage.Message.ShipStaticData.Name}`);

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

// shut ’er down!
async function exitScript() {
	// save the current ships cache to disk
	await saveData(current_ships_cache, { filepath: current_ships_filepath, format: 'json', append: false });

	// // run summary stats
	// const data = await fetchShipData(`${ships_data_filepath}.csv`);
	// await generateSummaryStats(data);

	// close websocket
	socket.close();

	console.log(`Shutting down script run: ${new Date()}`);
	
	// exit script
	process.exit(0);
}


// get currentShipPositions
async function getCurrentShips(aisMessage) {
	const shipDetails = [];
	const metaData = aisMessage.MetaData;
	const positionReport = aisMessage.Message.PositionReport;

	console.log(`CURRENT_SHIP: ${metaData.ShipName.trim()}, ${positionReport.NavigationalStatus}`);
	// console.log(aisMessage)

	// check navstatus to see if ship is moored or at anchor
	// https://api.vesselfinder.com/docs/ref-navstat.html
	if (positionReport.NavigationalStatus === 1 || positionReport.NavigationalStatus === 5) {
		// get mmsi number
		let mmsi = metaData.MMSI;
		// is MMSI already in the cache of moored ships?
		let shipCached = current_ships_cache.some(d => d.MMSI === mmsi);
		// console.log(`Ship cached: ${shipCached}`)

		// if mmsi isn't cached as currently moored, do so.
		if (shipCached === false) {
			const ship = ships_list.filter(d => d.MMSI === mmsi);
			if (ship.length > 0) {
				// fetch ship details from Equasis
				// let shipDetails = await fetchShipDetails(ship[0]);
				let shipDetails = ship[0];
				shipDetails.terminal = getTerminal(positionReport.Latitude, positionReport.Longitude);

				// console.log(shipDetails)

				current_ships_cache.push(shipDetails);
			}

			// console.log(JSON.stringify(current_ships_cache))
			
			// post announcement to social media
			// postToTwitter(data);
		}
	}
}

// staticshipdata includes imo, mmsi, ship type, size, etc
async function getShipStaticData(aisMessage) {
	let data = aisMessage.Message.ShipStaticData;

	console.log(`STATIC SHIP: ${data.Type} ${data.Name}`);

	// timestamp to local ymd format
	const timestamp = aisMessage.MetaData.time_utc;
	const date = new Date(timestamp);
	data.date = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
	// create array from Eta
	const timeArray = `${date.getFullYear()},${data.Eta.Month},${data.Eta.Day},${data.Eta.Hour},${data.Eta.Minute}`;

	// if new IMO or ship not in `current_ships cache`
	const imoExists = ships_list.some(d => d.ImoNumber === data.ImoNumber);
	let etaExists = ships_list.some(d => d.Eta ? d.Eta === timeArray : undefined);
	// ships sometimes update destination & ETA while moored, which leads to double counting
	const isCached = current_ships.some(d => d.ImoNumber === data.ImoNumber);

	console.log(`IMO exists: ${imoExists}`);
	console.log(`ETA exists: ${etaExists}`);
	console.log(`Cached: ${isCached}`);

	if (!imoExists || (imoExists && !etaExists) || !isCached) {
	// if (!imoExists || !isCached) {
		console.log(`New ship in boundary: ${aisMessage.MetaData.ShipName}`);

		// trim whitespace from strings
		data.CallSign = data.CallSign.trim();
		// calculate ship dimensions (m)
		data.Destination = data.Destination.trim();
		data.Dimension = calculateShipDimensions(data.Dimension);
		data.Eta = timeArray;
		data.Name = data.Name.trim();
		// get mmsi & arrival date
		data.MMSI = aisMessage.MetaData.MMSI;
		data.time_utc = timestamp;
		// determine terminal
		data.terminal = getTerminal(aisMessage.MetaData.latitude, aisMessage.MetaData.longitude);
		
		// update ships_data array & save full ship data to disk
		await saveData([data], { filepath: ships_data_filepath, format: 'csv', append: true });

		// save data to use for a lookup (using object destructuring)
		updateLookupTable(data);
		await saveData(ships_list, { filepath: ships_lookup_filepath, format: 'json', append: false });
	}
}

// check if ship lat/lon is inside one of the defined terminal zones
// function getTerminal(data) {
function getTerminal(lat,lon) {
	let terminal;

	// ship position
	// const point = ([data.MetaData.latitude, data.MetaData.longitude]);
	const point = ([lat,lon]);

	// determine where ship is located
	if (booleanPointInPolygon(point, westridge_poly)) {
		terminal = 'Westridge';
	} else if (booleanPointInPolygon(point, suncor_poly)) {
		terminal = 'Suncor';
	// } else if (booleanPointInPolygon(point, ebay_poly)) {
	// 	terminal = 'English Bay'
	}

	if (terminal == undefined) {
		console.log(`Terminal undefined`)
		console.log(point, lat, lon)
	}

	return terminal;
}

// update a ship lookup table with imo, mmsi & eta from the full dataset
function updateLookupTable(data) {
	let lookup = (({ImoNumber, MMSI, Eta, Destination}) => ({ImoNumber, MMSI, Eta, Destination}))(data);
	ships_list.push(lookup);
}

async function init(url, apiKey) {
	console.log(`Starting new script run: ${new Date()}`);

	// start web socket to aisstream
	aisStream(url, apiKey);

	// convert runtime to ms
	const streamDuration = (runtime * 60) * 1000;

	// close the stream after `streamDuration` minutes
	setTimeout(exitScript, streamDuration);
}

// kick isht off!!!
export default { init };