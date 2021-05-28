const RISKMOONLIB = require('./riskmoonlib.js');

(async function () {
  const rmPrice = new RISKMOONLIB.RiskmoonPrice();  
  const stats = new RISKMOONLIB.RiskmoonStats();


  // Get price every second
  setInterval(async function() {
    const price = await rmPrice.getLatestPrice();
    const pricePer1M = price.multipliedBy(Math.pow(10, 6));
    const burnedTokens = await stats.getBurnedTokens();
    const totalSupply = await stats.getTotalSupply();
    const totalSupplyInT = (totalSupply/Math.pow(10,12));
    const totalCirculation = totalSupply-burnedTokens;
    const burnedTokensInT = (burnedTokens/Math.pow(10,12)).toFixed(1);
    const priceBurnedTokens = stats.getDollarFormatted(price * burnedTokens);
    const totalCirculationInT = (totalCirculation / Math.pow(10,12)).toFixed(1);
    const marketCap =  stats.getDollarFormatted((price * totalCirculation));

    console.log(`1M tokens = \$${pricePer1M.toFixed(6)}`);
    console.log(`Market Cap: ${marketCap}`);
    console.log(`Circulating Supply: ${totalCirculationInT}T / ${totalSupplyInT}T`);
    console.log(`Total burned: ${burnedTokensInT}T / ${priceBurnedTokens}`);
    console.log('======');
  }, 1000);

})();