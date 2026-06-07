import fs from 'fs';
import WebSocket from 'ws';
import Papa from 'papaparse';
import saveData from './save-data.js';
import { point, polygon } from '@turf/helpers';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import generateSummaryStats from './generate-summary-stats.js';
import getShipDetails from './get-ship-details.js';

// DATA
import zones from '../data/static/zone-coords.js';
import remoteCache from '../data/current-ships.js';


// VARS
const useSSL = false;
let localCacheModified = false;
let socket, kitimat_poly, parkland_poly, suncor_poly, westridge_poly;
const localCache = [...remoteCache];
const pendingRemoval = new Set();

// https://api.vesselfinder.com/docs/ref-aistypes.html
const ship_types = [9, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89]; // 80+ === tanker, 70 === cargo

// FILEPATHS
const ships_data_filepath = './data/ships-data';
const remoteCache_filepath = './data/current-ships';

async function openWebSocket(url, apiKey) {
	socket = new WebSocket(url,
		{ rejectUnauthorized: useSSL }
	);

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
				// Burrard Inlet (covers Westridge, Suncor & Parkland terminals + departure lanes)
				[zones.burrard_inlet[0], zones.burrard_inlet[2]],

				// Kitimat (expanded beyond terminal to catch departures along Douglas Channel)
				zones.kitimat_bbox,
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

			// Monitor PositionReports
			if (aisMessage.MessageType === 'PositionReport') {
				const mmsi = aisMessage.MetaData.MMSI;
				if (localCache.some(d => d.MMSI === mmsi)) {
					getPositionReport(aisMessage);
				}
			}

		// get static ship data on ships in bboxes
		if (aisMessage.MessageType === 'ShipStaticData') {
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

// shut ‘er down!
async function exitScript() {
	// flush pending departures before checking whether cache changed
	for (const mmsi of pendingRemoval) {
		const idx = localCache.findIndex(d => d.MMSI === mmsi);
		if (idx !== -1) {
			console.log(`Removing departed ship from cache: ${localCache[idx].Name} (MMSI: ${mmsi})`);
			localCache.splice(idx, 1);
			localCacheModified = true;
		}
	}

	// save the current ships cache to disk if ships were added or removed
	if (localCacheModified) {
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
async function getPositionReport(aisMessage) {
	const metaData = aisMessage.MetaData;
	const positionReport = aisMessage.Message.PositionReport;
	const mmsi = metaData.MMSI;

	console.log(`POSTITION REPORT: ${metaData.ShipName.trim()}, NavStatus: ${positionReport.NavigationalStatus}`);

	// skip departure detection for ships first detected in this run — PositionReports may still be stale
	if (!remoteCache.some(d => d.MMSI === mmsi)) return;

	// NavStatus 0 = Under Way Using Engine, 8 = Under Way Sailing
	// https://api.vesselfinder.com/docs/ref-navstat.html
	if (positionReport.NavigationalStatus === 0 || positionReport.NavigationalStatus === 8) {
		const terminal = getTerminal(metaData.latitude, metaData.longitude);
		if (terminal === 'NA' && localCache.some(d => d.MMSI === mmsi) && !pendingRemoval.has(mmsi)) {
			console.log(`Ship departing, marked for removal: ${metaData.ShipName.trim()} (MMSI: ${mmsi})`);
			pendingRemoval.add(mmsi);
		}
	}
}

// staticshipdata includes imo, mmsi, ship type, size, etc
async function getShipStaticData(aisMessage) {
	let data = aisMessage.Message.ShipStaticData;
	data.MMSI = aisMessage.MetaData.MMSI;

	console.log('');
	console.log(`STATIC SHIP DATA: ${data.ImoNumber} ${data.Name}`);

	// ship is already tracked as moored — skip until it departs (NavStatus 0 or 8)
	const isLocalCache = localCache.some(d => d.ImoNumber === data.ImoNumber);
	console.log(`SSD: isLocalCache: ${isLocalCache}`);
	if (isLocalCache) { return; }

	// NOTE: SOME SHIPS FALSELY REPORT TYPE===80 - THEY DON'T TYPICALLY HAVE AN IMONUMBER
	if (data.ImoNumber === 0) { return; }

	// new tanker detected in bounding box — ignore if not within a known terminal zone
	const terminal = getTerminal(aisMessage.MetaData.latitude, aisMessage.MetaData.longitude);
	if (terminal === 'NA') { return; }

	console.log('');
	console.log(`NEW TANKER DETECTED`);
	console.log(`  Name:     ${data.Name.trim()}`);
	console.log(`  IMO:      ${data.ImoNumber}`);
	// console.log(`  MMSI:     ${data.MMSI}`);
	// console.log(`  Terminal: ${terminal}`);
	// console.log(`  Type:     ${data.Type}`);

	// data cleanup
	const timestamp = aisMessage.MetaData.time_utc;
	const date = new Date(timestamp);
	data.date = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
	data.CallSign = data.CallSign.trim();
	data.Destination = data.Destination.trim();
	data.Dimension = calculateShipDimensions(data.Dimension);
	data.Eta = `${date.getFullYear()},${data.Eta.Month},${data.Eta.Day},${data.Eta.Hour},${data.Eta.Minute}`;
	data.Name = data.Name.trim();
	data.time_utc = timestamp;
	data.terminal = terminal.trim();

	// add to localcache
	addToLocalCache(data);

	// save to csv
	const row = {
		AisVersion: data.AisVersion,
		CallSign: data.CallSign,
		Destination: data.Destination,
		Dimension: data.Dimension,
		Dte: data.Dte,
		Eta: data.Eta,
		FixType: data.FixType,
		ImoNumber: data.ImoNumber,
		MaximumStaticDraught: data.MaximumStaticDraught,
		MessageID: data.MessageID,
		Name: data.Name,
		RepeatIndicator: data.RepeatIndicator,
		Spare: data.Spare,
		Type: data.Type,
		UserID: data.UserID,
		Valid: data.Valid,
		date: data.date,
		MMSI: data.MMSI,
		time_utc: data.time_utc,
		terminal: data.terminal,
	};
	await saveData([row], { filepath: ships_data_filepath, format: 'csv', append: true });

	console.log(`SSD: localCache: ${JSON.stringify(localCache)}`);
}

// add new ship to local cache to be saved on script exit
function addToLocalCache(data) {
	console.log(`Adding to local cache: ${data.ImoNumber}`);
	localCacheModified = true;
	localCache.push({
		ImoNumber: data.ImoNumber,
		MMSI: data.MMSI,
		Name: data.Name.trim(),
		terminal: data.terminal
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
		console.log(`Terminal undefined for lat/lon: ${lat}, ${lon}`);
		terminal = 'NA';
	}

	return terminal;
}


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