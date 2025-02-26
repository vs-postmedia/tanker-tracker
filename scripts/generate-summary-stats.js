import fs from 'fs';
import Papa from 'papaparse';
import saveData from './save-data.js';
import getShipDetails from './get-ship-details.js';
import { tidy, arrange, count, cumsum, groupBy, leftJoin, mutateWithSummary, n, nDistinct, pivotWider, select, summarize } from '@tidyjs/tidy';

// VARS
const topImoCount = 5; // how many ships will display in the topImos table?
const directory = './data/output/';
const ships_data_filepath = './data/ships-data';
const shipInfoFilepath = './data/top-imo-details';


// FUNCTIONS
async function updateTopImoData(topImoCount, shipsUnique) {
	// get the top x IMOs & fetch details from equasis
	const topImos = shipsUnique.sort((a,b) => b.count - a.count).slice(0, topImoCount);

	// NEED TO HAVE A TRY/CATCH BLOCK HERE
	// get ship details for ships that moor most often
	const equasisResults = await getShipDetails.init(topImos);

	// merge topImos back into shipDetails to get the moorings count
	const shipDetailsMerged = tidy(
		equasisResults.ship_info,
		leftJoin(topImos, {by: ['ImoNumber']})
	);

	return shipDetailsMerged;
}
// overall summary
async function generateSummaryStats(allData) {
    console.log('Generating summary stats...');

    // we dont want ships that weren't in one of the terminals
    const data = allData.filter(d => d.terminal.length > 0)

    allData.forEach(d => {
        // better to strip blank lines out of ships-data.csv but...
        if (d.date !== undefined) { d.year_month = d.date.slice(0, -3); }
    });

    // total ship count
    const shipsTotal = data.length;

    // get ship count by day
    const shipsDaily = tidy(
        data,
        groupBy(['date', 'terminal'], [
            summarize({
                total: n()
            })
        ])
    );

    // get ship count by month
    const shipsMonthly = tidy(
        data,
        groupBy(['year_month', 'terminal'], [
            summarize({
                total: n()
            })
        ]),
        pivotWider({
            namesFrom: 'terminal',
            valuesFrom: 'total'
        })
    );

    // cumulative sums by terminal
    const shipsCumulative = tidy(
        data,
        groupBy(['year_month', 'terminal'], [
            summarize({
                total: n()
            })
        ]),
        groupBy(['terminal'], [
            mutateWithSummary({
                cumulativeCount: cumsum('total')
            })
        ]),
        select(['-total']),
        pivotWider({
            namesFrom: 'terminal',
            valuesFrom: 'cumulativeCount'
        })
    );  

    // get ship count by by IMO
    const shipsUnique = tidy(
        data,
        groupBy('ImoNumber', [
            summarize({
                count: n('ImoNumber')
            })
        ]
        )
    );

	// get data from equasis on the ships that moor most often & save it to disk
	const topImos = await updateTopImoData(topImoCount, shipsUnique);
	await saveData(topImos, { filepath: shipInfoFilepath, format: 'csv', append: false });

    // save summary data files (daily, monthly, cumulative and unique)
    await saveData(shipsUnique, { filepath: `${directory}ships-unique`, format: 'csv', append: false });
    await saveData(shipsDaily, { filepath: `${directory}ships-daily`, format: 'csv', append: false });
    await saveData(shipsMonthly, { filepath: `${directory}ships-monthly`, format: 'csv', append: false });
    await saveData(shipsCumulative, { filepath: `${directory}ships-cumulative`, format: 'csv', append: false });

    return shipsUnique;
}

export default generateSummaryStats;