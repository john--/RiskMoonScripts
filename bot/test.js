const RISKMOONLIB = require('./riskmoonlib.js');

(async function () {
  let rmPrice = new RISKMOONLIB.RiskmoonPrice();

  // Get price every second
  setInterval(async function() {
    const price = await rmPrice.getLatestPrice();
    const pricePer1M = price.multipliedBy(Math.pow(10, 6));
    console.log(`!!Time: ${new Date()}, Price: ${price.toString()}, Per 1M Riskmoon: ${pricePer1M.toString()}`);
  }, 1000);

})();