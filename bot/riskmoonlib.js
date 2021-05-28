// A Riskmoon library for common on-chain data. Currently just price data.
// If you steal this, at least give me some credit.
const PANCAKESWAP_FACTORY_ADDR_V1 = "0xBCfCcbde45cE874adCB698cC183deBcF17952812";
const PANCAKESWAP_FACTORY_ADDR_V2 = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
const ADDRESS_BNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const ADDRESS_RISKMOON = "0xa96f3414334F5A0A529ff5d9D8ea95f42147b8C9";
const ADDRESS_USDT = "0xe9e7cea3dedca5984780bafc599bd69add087d56";
const BigNumber = require("bignumber.js");
Web3 = require("web3");

class RiskmoonPrice {
  web3 = new Web3("https://bsc-dataseed1.binance.org:443");
  pancakeswapFactoryAbi = require("./abis/PancakeFactoryV2.json");
  pancakeswapPairAbi = require("./abis/PancakePair.json");
  riskmoonAbi = require("./abis/RiskMoon.json");

  riskmoonContract = new this.web3.eth.Contract(
    this.riskmoonAbi,
    ADDRESS_RISKMOON
  );
  pancakeswapFactoryV1 = new this.web3.eth.Contract(
    this.pancakeswapFactoryAbi,
    PANCAKESWAP_FACTORY_ADDR_V1
  );
  pancakeswapFactoryV2 = new this.web3.eth.Contract(
    this.pancakeswapFactoryAbi,
    PANCAKESWAP_FACTORY_ADDR_V2
  );

  constructor() {
    this.init();
  }

  init = async function () {
    this.riskmoonDecimals = await this.riskmoonContract.methods
      .decimals()
      .call();
      this.contractPairs = [
        await this.getContractPair(this.pancakeswapFactoryV1, ADDRESS_RISKMOON, ADDRESS_BNB), // index 0: PCS V1, pairA = RISKMOON/BNB
        await this.getContractPair(this.pancakeswapFactoryV2, ADDRESS_RISKMOON, ADDRESS_BNB), // index 1: PCS V2, pairA = RISKMOON/BNB
        await this.getContractPair(this.pancakeswapFactoryV1, ADDRESS_BNB, ADDRESS_USDT), // index 3: PCS V1, pairB = BNB/USDT
        await this.getContractPair(this.pancakeswapFactoryV2, ADDRESS_BNB, ADDRESS_USDT), // index 4: PCS V2, pairB = BNB/USDT
      ];
  };

  getContractPair = async function (factory, address0, address1) {
    const pairAddress = await factory.methods
      .getPair(address0, address1)
      .call();
    return new this.web3.eth.Contract(this.pancakeswapPairAbi, pairAddress);
  };

  // Price is reserve1/reserve0. However, sometimes we want to take the average of all of the pairs in the
  // event there are multiple liquidity pools. This helps in those cases.
  getAveragedPriceFromReserves = function (reserveList) {
    const reserve0 = reserveList.reduce(
      (a, b) => a.plus(new BigNumber(b["0"])),
      new BigNumber(0)
    );
    const reserve1 = reserveList.reduce(
      (a, b) => a.plus(new BigNumber(b["1"])),
      new BigNumber(0)
    );
    return reserve1.dividedBy(reserve0);
  };

  // web3.eth.BatchRequest allows us to batch requests, but each of the requests
  // have their own callback and return individually. It makes it a little hard to manage like this.
  // This is just a Promise that returns the entire result once they've all completed.
  batchCalls = function (calls) {
    return new Promise((resolve, reject) => {
      let operations = calls.map((c) => ({
        call: c,
        completed: false,
        result: null,
      }));

      const callback = function (call, error, response) {
        if (error) {
          reject(error);
        }

        const currentOperation = operations.find((c) => c.call === call);
        currentOperation.completed = true;
        currentOperation.result = response;

        if (operations.every((o) => o.completed)) {
          resolve(operations);
        }
      };

      let batch = new this.web3.eth.BatchRequest();
      calls.forEach((call) => {
        batch.add(call.call.request((e, r) => callback(call, e, r)));
      });

      batch.execute();
    });
  };

  getLatestPrice = async function () {
    const reservesResults = await this.batchCalls(
      this.contractPairs.map((cp) => cp.methods.getReserves())
    );

    // Calculate average price for Riskmoon/BNB pair from reserves for PCS V1/V2
    const pairPriceA = this.getAveragedPriceFromReserves([
      reservesResults[0].result,
      reservesResults[1].result,
    ]);

    // Calculate average price for BNB/USDT pair from reserves for PCS V1/V2
    const pairPriceB = this.getAveragedPriceFromReserves([
      reservesResults[2].result,
      reservesResults[3].result,
    ]);

    // Multiply pair A by pair B to get the USD value
    let price = pairPriceA.multipliedBy(pairPriceB);

    // number is still a whole number, apply the proper decimal places from the contract (9)
    return price.dividedBy(Math.pow(10, this.riskmoonDecimals));
  };
}

module.exports.RiskmoonPrice = RiskmoonPrice;
