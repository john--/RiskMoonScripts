const RISKMOONLIB = require('./riskmoonlib.js');
const TelegramBot = require('node-telegram-bot-api')
const BOTTOKEN = 'token_goes_here';
const bot = new TelegramBot(BOTTOKEN, { polling: true });
const rmPrice = new RISKMOONLIB.RiskmoonPrice();

bot.on('channel_post', (msg) => {
  if (msg.text.startsWith('/price')) {
    const chatId = msg.chat.id;
    const price = rmPrice.getLatestPrice().then(price => {
        const pricePer1M = price.multipliedBy(Math.pow(10, 6)).toFixed(6);
        const reply = `1M tokens = \$${pricePer1M.toString()}`;
        bot.sendMessage(chatId, reply)
    });
  }
});
