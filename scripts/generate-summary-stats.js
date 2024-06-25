import fs from 'fs';
import Papa from 'papaparse';
import saveData from './save-data.js';
import { tidy, count, groupBy, n, nDistinct, summarize } from '@tidyjs/tidy';

// VARS
let shipsData;
const shipdataFilepath = './data/ships-data.csv';
const summaryStatsFilepath = './data/summary-stats';

// FUNCTIONS
async function generateSummaryStats(data) {
    console.log('Summary stats!')
    
    // total ship count
    const shipsTotal = data.length;
    
    // year-month of ship arrival
    data.forEach(d => {
        d.year_month = d.date.slice(0, -3);
    });
        
    // ship count by month
    const shipsMonthly = tidy(
        data,
        groupBy('year_month', [
            summarize({
                total: n()
            })
        ])
    );

    // ships by IMO
    const shipsUnique = tidy(
        data,
        groupBy('ImoNumber', [
            summarize({
                count: nDistinct('ImoNumber')
            })
        ]
        )
    );


    console.log(shipsTotal)
    console.log(shipsMonthly)
    console.log(shipsUnique)

    saveData(shipsUnique, summaryStatsFilepath, 'csv');
}

async function init() {
    const file = fs.readFileSync(shipdataFilepath, 'utf8');

    Papa.parse(file, {
        complete: (res) => {
            console.log(res)

            shipsData = res;
            generateSummaryStats(shipsData.data)
        },
        delimiter: ',',
        header: true
    });
}
export default init;