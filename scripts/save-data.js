import fs from 'fs';
import Papa from 'papaparse';

async function saveData(data, filepath, format, data_dir) {
	// save file locally%
	if (format === 'json') {
		try {
			fs.writeFileSync(`${filepath}.${format}`, JSON.stringify(data));
			console.log(`Saved to ${filepath}`);
		} catch (err) {
			console.error(err);
		}
	} else {
		try {
			// covert to csv and append line to file
			fs.appendFile(
				`${filepath}.${format}`, 
				// `\n${parser.parse(data)}`, 
				`\n${Papa.unparse(data, { header: false })}`,
				// {encoding: 'utf8' }, 
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