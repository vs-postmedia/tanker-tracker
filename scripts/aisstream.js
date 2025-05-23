import fs from 'fs';
import WebSocket from 'ws';
import Papa from 'papaparse';
import saveData from './save-data.js';
// import { tidy, leftJoin } from '@tidyjs/tidy';
import { point, polygon } from '@turf/helpers';
// import { postToTwitter } from './post-online.js';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import generateSummaryStats from './generate-summary-stats.js';
import getShipDetails from './get-ship-details.js';

// DATA
import zones from '../data/zone-coords.js';
import shipsLookup from '../data/ships-lookup.js';
import remoteCache from '../data/current-ships.js';


// VARS
let ssdMsgCount = 0;
// const topImoCount = 2; // how many ships will display in the topImos table?
let socket, kitimat_poly, parkland_poly, suncor_poly, westridge_poly; 
const localCache = [];
const shipsLookup_lookup = [];
// const shipInfoFilepath = './data/ship-info-data';

// https://api.vesselfinder.com/docs/ref-aistypes.html
const ship_types = [9, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89]; // 80+ === tanker, 70 === cargo

// FILEPATHS
const ships_data_filepath = './data/ships-data';
const remoteCache_filepath = './data/current-ships';
const ships_lookup_filepath = './data/ships-lookup';

async function openWebSocket(url, apiKey) {
	socket = new WebSocket(url);

	// create polygons for terminals
	westridge_poly = polygon([zones.westridge]);
	parkland_poly = polygon([zones.parkland]);
	kitimat_poly = polygon([zones.kitimat]);
	suncor_poly = polygon([zones.suncor]);

	socket.addEventListener('open', _ => {
		// setup websocket request
		const subscriptionMsg = {
			APIkey: apiKey,
			BoundingBoxes: [
				// Westridge Terminal
				[zones.westridge[0], zones.westridge[2]],
				
				// Suncor Terminal
				[zones.suncor[0], zones.suncor[2]],

				// Parkland
				[zones.parkland[0], zones.parkland[2]],

				// Kitimat
				[zones.kitimat[0], zones.kitimat[2]],
			],
			FilterMessageTypes: ['PositionReport', 'ShipStaticData']
		};

		console.log(JSON.stringify(subscriptionMsg.FilterMessageTypes));
		console.log(`remoteCache: ${JSON.stringify(remoteCache)}`)
		
		// open AISstream websocket
		socket.send(JSON.stringify(subscriptionMsg));
	});
	
	// on socket close
	socket.addEventListener('close', (e) => {
		if (e.code === 1006) {
			// 1006 errors come up fairly often
			console.log(`WebSocket connection closed with code 1006, trying to reconnect...`);
			setTimeout(() => openWebSocket(url, apiKey), 5000);
		} else {
			console.log(`WebSocket connection closed, code: ${e.code}`);
			exitScript();
		}
	});

	// error msg
	socket.addEventListener('error', (e) => {
		console.log(`Socket setup failed: ${JSON.stringify(e)}`);
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
			// check ship type
			if (ship_types.includes(aisMessage.Message.ShipStaticData.Type)) {
				// sometimes socket stops transmitting, leading to dupes
				ssdMsgCount += 1;
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
	// save the current ships cache to disk if we've received new messages
	if (ssdMsgCount > 0) {
		await saveData(localCache, { filepath: remoteCache_filepath, format: 'js', append: false });
		// we probably don't need this one....
		await saveData(localCache, { filepath: remoteCache_filepath, format: 'json', append: false });
	}

	// generate summary stats
	const data = await fetchShipData(`${ships_data_filepath}.csv`);
	await generateSummaryStats(data);

	// close websocket
	socket.close();

	console.log(`Shutting down script run: ${new Date()}`);
	
	// exit script
	process.exit(0);
}

async function fetchShipData(filepath) {
	let data;
    // read in the master csvfile
    const file = fs.readFileSync(filepath, 'utf8');

    // convert to json
    Papa.parse(file, {
        complete: (response) => {
            // NEEDS ERROR LOG HERE
			data = response.data;
        },
        delimiter: ',',
        header: true
    });
	
	return data;
}

// get currentShipPositions
async function getCurrentShips(aisMessage) {
	const shipDetails = [];
	const metaData = aisMessage.MetaData;
	const positionReport = aisMessage.Message.PositionReport;

	console.log(`GET CURRENT SHIPS: ${metaData.ShipName.trim()}, ${positionReport.NavigationalStatus}`);

	// check navstatus to see if ship is moored or at anchor
	// https://api.vesselfinder.com/docs/ref-navstat.html
	if (positionReport.NavigationalStatus === 1 || positionReport.NavigationalStatus === 5) {
		// get mmsi number
		let mmsi = metaData.MMSI;
		// is MMSI already in the cache of moored ships?
		let shipCached = localCache.some(d => d.MMSI === mmsi);

		// if mmsi isn't cached as currently moored, do so.
		if (shipCached === false) {
			const ship = shipsLookup.filter(d => d.MMSI === mmsi);
			if (ship.length > 0) {
				// fetch ship details from Equasis
				// let shipDetails = await fetchShipDetails(ship[0]);
				let shipDetails = ship[0];

				// localCache.push(shipDetails);
				// addToLocalCache(shipDetails)
			}

			// console.log(`GCS: localCache: ${JSON.stringify(localCache)}`)
			
			// post announcement to social media
			// postToTwitter(data);
		}
	}
}

// staticshipdata includes imo, mmsi, ship type, size, etc
async function getShipStaticData(aisMessage) {
	let data = aisMessage.Message.ShipStaticData;

	console.log(`STATIC SHIP DATA: ${data.Type} ${data.Name}`);

	// timestamp to local ymd format
	const timestamp = aisMessage.MetaData.time_utc;
	const date = new Date(timestamp);
	data.date = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;

	// create array from Eta
	const timeArray = `${date.getFullYear()},${data.Eta.Month},${data.Eta.Day},${data.Eta.Hour},${data.Eta.Minute}`;

	// if we've never seen this IMO before - MAYBE DON'T NEED???
	let imoExists = shipsLookup.some(d => d.ImoNumber === data.ImoNumber && d.timeArray === data.timeArray);

	// this is written to current-ships.json on script exit
	let isLocalCache = localCache.some(d => d.ImoNumber === data.ImoNumber && d.timeArray === timeArray);

	// timeArray changes when destination does & that makes a duplicate entry
	let newDestination = remoteCache.some(d => d.ImoNumber === data.ImoNumber && d.Destination !== data.Destination.trim());
	
	// ships cache loaded from github
	let isRemoteCache = remoteCache.some(d => d.ImoNumber === data.ImoNumber && d.timeArray === timeArray);

	console.log(`SSD: IMO exists: ${imoExists}`);
	console.log(`SSD: localCache: ${isLocalCache}`);
	console.log(`SSD: remoteCache: ${isRemoteCache}`);
	console.log(`SSD: newDestination: ${newDestination}`);

	if (!isLocalCache && newDestination) {
		console.log(`SSD: ${data.ImoNumber} departing...`);
		addToLocalCache(data, timeArray);
	} else if (!imoExists && !isRemoteCache && !isLocalCache) {
		// if we don't have the imo & date saved or the imo isn't in the local or remote cache, it's a new ship
		console.log(`SSD: New ship in boundary: ${aisMessage.MetaData.ShipName}`);

		// save new ship in local cache (we'll save to disk on exit)
		addToLocalCache(data, timeArray);

		// NOTE: SOME SHIPS FALSELY REPORT TYPE===80 - THEY DON'T TYPICALLY HAVE AN IMONUMBER
		if (data.ImoNumber === 0) {return}

		// trim whitespace from strings
		data.CallSign = data.CallSign.trim();
		data.Destination = data.Destination.trim();
		// calculate ship dimensions (m)
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

		// save data to use for a lookup
		const updatedLookup = updateLookupTable(data);
		// console.log(updatedLookup)
		await saveData(updatedLookup, { filepath: ships_lookup_filepath, format: 'json', append: false });
	// ship is cached remotely but not locally
	} else if (!isLocalCache) {
+       // save new ship in local cache (we'll save to disk on exit)
+       addToLocalCache(data, timeArray);
	}

	console.log(`SSD: localCache: ${JSON.stringify(localCache)}`)
}

// add new ship to local cache to be saved on script exit
function addToLocalCache(data, timeArray) {
	console.log(`Adding to local cache: ${data.ImoNumber}`);
	localCache.push({
		Destination: data.Destination.trim(),
		ImoNumber: data.ImoNumber,
		// MMSI: data.MMSI,
		// date: data.date,
		timeArray: timeArray
	});
}

// check if ship lat/lon is inside one of the defined terminal zones
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
	} else if (booleanPointInPolygon(point, parkland_poly)) {
		terminal = 'Parkland';
	} else if (booleanPointInPolygon(point, kitimat_poly)) {
		terminal = 'Kitimat';
	} 

	if (terminal == undefined) {
		console.log(`Terminal undefined`)
		console.log(point, lat, lon);
		terminal = undefined;
	}

	return terminal;
}

// update a ship lookup table with imo & mmsi & date
function updateLookupTable(data) {
	const lookup = (({ImoNumber, MMSI, date}) => ({ImoNumber, MMSI, date}))(data);

	// push to array to save to disk
	shipsLookup.push(lookup);
	
	// remove dups
	const uniqueShips = Array.from(
		new Set(shipsLookup
			.map(ship => JSON.stringify(ship))
		))
    	.map(ship => JSON.parse(ship));

	return uniqueShips
}

// async function updateTopImoData(topImoCount) {
// 	// run summary stats
// 	const data = await fetchShipData(`${ships_data_filepath}.csv`);
// 	const shipsUnique = await generateSummaryStats(data);
	
// 	// get the top x IMOs & fetch details from equasis
// 	const topImos = shipsUnique.sort((a,b) => b.count - a.count).slice(0,topImoCount);

// 	// NEED TO HAVE A TRY/CATCH BLOCK HERE
// 	// get ship details for ships that moor most often
// 	const equasisResults = await getShipDetails.init(topImos);

// 	// merge topImos back into shipDetails to get the moorings count
// 	const shipDetailsMerged = tidy(
// 		equasisResults.ship_info,
// 		leftJoin(topImos, {by: ['ImoNumber']})
// 	);

// 	return shipDetailsMerged;
// }

async function init(url, apiKey, runtime) {
	console.log(`Starting new script run: ${new Date()}`);

	// start web socket to aisstream
	openWebSocket(url, apiKey);

	// convert runtime to ms
	const streamDuration = (runtime * 60) * 1000;

	// close the stream after `streamDuration` minutes
	setTimeout(exitScript, streamDuration);
}

// kick isht off!!!
export default { init };