import fs from 'fs';
import Papa from 'papaparse';
import saveData from './save-data.js';
import { tidy, count, groupBy, n, nDistinct, summarize } from '@tidyjs/tidy';

// VARS
const directory = './data/';
const shipdataFilepath = './data/ships-data.csv';

// FUNCTIONS
async function generateSummaryStats(data) {
    // console.log('Summary stats!')
    
    // get year/month date of ship arrivals
    data.forEach(d => {
        d.year_month = d.date.slice(0, -3);
    });

    // total ship count
    const shipsTotal = data.length;

    // get ship count by day
    const shipsDaily = tidy(
        data,
        groupBy('date', [
            summarize({
                total: n()
            })
        ])
    );
     
    // get ship count by month
    const shipsMonthly = tidy(
        data,
        groupBy('year_month', [
            summarize({
                total: n()
            })
        ])
    );

    // get ship count by by IMO
    const shipsUnique = tidy(
        data,
        groupBy('ImoNumber', [
            summarize({
                count: nDistinct('ImoNumber')
            })
        ]
        )
    );

    // log results
    // console.log(shipsTotal)
    console.log(`SUMMARY STATS: ${JSON.stringify(shipsMonthly)}`)
    // console.log(shipsUnique)

    // save summary data files
    saveData(shipsUnique, { filepath: `${directory}ships-unique`, format: 'csv', append: false });
    saveData(shipsDaily, { filepath: `${directory}ships-daily`, format: 'csv', append: false });
    saveData(shipsMonthly, { filepath: `${directory}ships-monthly`, format: 'csv', append: false });
}

async function init() {
    // read in the master csvfile
    const file = fs.readFileSync(shipdataFilepath, 'utf8');

    // convert to json
    Papa.parse(file, {
        complete: (response) => {
            // NEEDS ERROR LOG HERE

            // run summary stats
            generateSummaryStats(response.data)
        },
        delimiter: ',',
        header: true
    });
}
export default init;