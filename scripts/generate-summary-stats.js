import { tidy, count, groupBy, n, nDistinct, summarize } from '@tidyjs/tidy';

// DATA
import ships_data from '../data/ships-data.json' assert { type: 'json'};
// const ships_data = require('../data/ships-data.json');

// FUNCTIONS
async function generateSummaryStats() {
    console.log('Summary stats!')

    // total ship count
    const total_ships = ships_data.length;

    // ship count by month
    const monthly_ships = tidy(
        ships_data,
        groupBy('date', [
            summarize({
                total: n()
            })
        ])
    );

    // ships by IMO
    const unique_ships = tidy(
        ships_data,
        groupBy('ImoNumber', [
            summarize({
                count: nDistinct('ImoNumber')
            })
        ]
        )
    );


    console.log(total_ships)
    console.log(monthly_ships)
    console.log(unique_ships)
}


export default generateSummaryStats;
// module.exports = init;