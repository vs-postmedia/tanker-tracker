import fs from 'fs';
import Papa from 'papaparse';

async function saveData(data, options) {
	// console.log(options)
	if (options.append === true) {
		try {
			// covert to csv and append line to file
			fs.appendFile(
				`${options.filepath}.${options.format}`, 
				`\n${Papa.unparse(data, { header: false })}`,
				(err) => {
					if (err) {
						console.err('Error: ', err);
					} else {
						console.log(`Saved to ${options.filepath}`);
					}
				}
			);
		} catch (err) {
			console.error(err);
		}
	} else if (options.append === false) {
		if (options.format === 'json') {
			try {
				// over/write json file
				fs.writeFileSync(`${options.filepath}.${options.format}`, JSON.stringify(data));
				console.log(`Saved to ${options.filepath}`);
			} catch (err) {
				console.error(err);
			} 
		} else if (options.format === 'csv') {
			// covert to csv and over/write file
			fs.writeFile(
				`${options.filepath}.${options.format}`, 
				`${Papa.unparse(data, { header: true })}\n`,
				(err) => {
					if (err) {
						console.err('Error: ', err);
					} else {
						console.log(`Saved to ${options.filepath}`);
					}
				}
			);
		}
	}
}

export default saveData;