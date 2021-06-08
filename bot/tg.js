const RISKMOONLIB = require('./riskmoonlib.js');
const TelegramBot = require('node-telegram-bot-api');
const dotenv = require('dotenv').config({
  path: './secrets/.env'
});
const BOTTOKEN = process.env.BOTTOKEN;
const bot = new TelegramBot(BOTTOKEN, { polling: true });
const rmPrice = new RISKMOONLIB.RiskmoonPrice();  
const stats = new RISKMOONLIB.RiskmoonStats();

bot.on('message', async (msg) => {
  if (!!msg && !!msg.text && msg.text.startsWith('/price')) {
    const chatId = msg.chat.id;

    const price = await rmPrice.getLatestPrice();
    const pricePer1M = price.multipliedBy(Math.pow(10, 6));
    const burnedTokens = await stats.getBurnedTokens();
    const totalSupply = await stats.getTotalSupply();
    const totalSupplyInT = (totalSupply/Math.pow(10,12));
    const totalCirculation = totalSupply-burnedTokens;
    const burnedTokensInT = (burnedTokens/Math.pow(10,12)).toFixed(1);
    const priceBurnedTokens = stats.getDollarFormatted(price * burnedTokens);
    const totalCirculationInT = (totalCirculation / Math.pow(10,12)).toFixed(1);
    const marketCap =  stats.getDollarFormatted(price * totalCirculation);

    let reply =
`*RISKMOON*
1M tokens = \$${pricePer1M.toFixed(6)}
💴 *Market Cap*: ${marketCap}
💰 *Circulating Supply*: ${totalCirculationInT}T / ${totalSupplyInT}T
🔥 *Total burned*: ${burnedTokensInT}T / ${priceBurnedTokens}

[Buy](https://rsk.mn/buy) | [Wallet](https://rsk.mn/wallet) | [UniRocket](https://rsk.mn/unirocket) | [BSCScan](https://rsk.mn/bscscan) | [Website](https://riskmoon.com)
📈 *[Charts:](https://rsk.mn/chart)* [DexGuru](https://rsk.mn/dex) | [Bogged](https://rsk.mn/bog) | [DexT](https://rsk.mn/dext)
📣 *Social Insights:* [LunarCrush](https://rsk.mn/insights)
`;

    bot.sendMessage(chatId, reply, { parse_mode: 'Markdown' });
  }
});
