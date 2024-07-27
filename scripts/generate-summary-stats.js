import saveData from './save-data.js';
import { tidy, arrange, count, cumsum, groupBy, mutateWithSummary, n, nDistinct, pivotWider, select, summarize } from '@tidyjs/tidy';

// VARS
const directory = './data/';

// FUNCTIONS
// overall summary
async function generateSummaryStats(data) {
    // console.log(data)
    data.forEach(d => {
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

    // console.log(shipsUnique)

    // save summary data files
    saveData(shipsUnique, { filepath: `${directory}ships-unique`, format: 'csv', append: false });
    saveData(shipsDaily, { filepath: `${directory}ships-daily`, format: 'csv', append: false });
    saveData(shipsMonthly, { filepath: `${directory}ships-monthly`, format: 'csv', append: false });
    saveData(shipsCumulative, { filepath: `${directory}ships-cumulative`, format: 'csv', append: false });
}

export default generateSummaryStats;