import fs from 'fs';
import { Parser } from '@json2csv/plainjs';
// const fs = require('fs');
// let Parser = require('@json2csv/plainjs').Parser;

async function saveData(data, filepath, format, data_dir) {

	// save file locally
	if (format === 'json') {
		try {
			fs.writeFileSync(`${filepath}.${format}`, JSON.stringify(data));
			console.log(`Saved to ${filepath}`);
		} catch (err) {
			console.error(err);
		}
	} else {
		try {
			// create a json parser
			const parser = new Parser({ header: false });
			// covert to csv and append line to file
			fs.appendFile(
				`${filepath}.${format}`, 
				`\n${parser.parse(data)}`, 
				{encoding: 'utf8' }, 
				(err) => {
					if (err) {
						console.err('Error: ', err);
					} else {
						console.log(`Saved to ${filepath}`);
					}
				}
			);
		} catch (err) {
			console.error(err);
		}
	}
}

export default saveData;
// module.exports = saveData;