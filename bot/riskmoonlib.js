// A Riskmoon library for common on-chain data. Currently just price data.
// If you steal this, at least give me some credit.
const PANCAKESWAP_FACTORY_ADDR_V1 = "0xBCfCcbde45cE874adCB698cC183deBcF17952812";
const PANCAKESWAP_FACTORY_ADDR_V2 = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
const ADDRESS_BNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const ADDRESS_RISKMOON = "0xa96f3414334F5A0A529ff5d9D8ea95f42147b8C9";
const ADDRESS_USDT = "0xe9e7cea3dedca5984780bafc599bd69add087d56";
const ENABLE_PANCAKESWAP_V1 = true;
const ENABLE_PANCAKESWAP_V2 = true;
const BigNumber = require("bignumber.js");
const Web3 = require("web3");
const web3 = new Web3("https://bsc-dataseed1.binance.org:443");
const riskmoonAbi = require("./abis/RiskMoon.json");
const riskmoonContract = new web3.eth.Contract(
  riskmoonAbi,
  ADDRESS_RISKMOON
);

class RiskmoonStats {

  decimals = 9; // gets overriden at run-time

  constructor() {
    this.init();
  }

  init = async function () {
    this.numDecimals = await this.getDecimals();
  }

  getBurnedTokens = async function() {
    return (await riskmoonContract.methods
      .balanceOf('0x000000000000000000000000000000000000dead')
      .call())
      /Math.pow(10,this.numDecimals);
  }
  getTotalSupply = async function () {
    return (await riskmoonContract.methods
      .totalSupply()
      .call())
      /Math.pow(10,this.numDecimals);
  }
  getDecimals = async function () {
    return await riskmoonContract.methods
      .decimals()
      .call();    
  }
  getDollarFormatted = function (rawDollar) {
    return '$' + rawDollar.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
  }
}

class RiskmoonPrice {
  pancakeswapFactoryAbi = require("./abis/PancakeFactoryV2.json");
  pancakeswapPairAbi = require("./abis/PancakePair.json");
  pancakeswapFactoryV1 = new web3.eth.Contract(
    this.pancakeswapFactoryAbi,
    PANCAKESWAP_FACTORY_ADDR_V1
  );
  pancakeswapFactoryV2 = new web3.eth.Contract(
    this.pancakeswapFactoryAbi,
    PANCAKESWAP_FACTORY_ADDR_V2
  );

  constructor() {
    this.init();
  }

  init = async function () {
    this.riskmoonDecimals = await riskmoonContract.methods
      .decimals()
      .call();
      this.contractPairsA = [];
      this.contractPairsB = [];

      if (ENABLE_PANCAKESWAP_V1) {
        // PCS V1, pairA = RISKMOON/BNB
        this.contractPairsA.push(await this.getContractPair(this.pancakeswapFactoryV1, ADDRESS_RISKMOON, ADDRESS_BNB));

        // PCS V1, pairB = BNB/USDT
        this.contractPairsB.push(await this.getContractPair(this.pancakeswapFactoryV1, ADDRESS_BNB, ADDRESS_USDT));
      }
      
      if (ENABLE_PANCAKESWAP_V2) {
        // PCS V2, pairA = RISKMOON/BNB
        this.contractPairsA.push(await this.getContractPair(this.pancakeswapFactoryV2, ADDRESS_RISKMOON, ADDRESS_BNB));

        // PCS V2, pairB = BNB/USDT
        this.contractPairsB.push (await this.getContractPair(this.pancakeswapFactoryV2, ADDRESS_BNB, ADDRESS_USDT));
      }
      
  };

  getContractPair = async function (factory, address0, address1) {
    const pairAddress = await factory.methods
      .getPair(address0, address1)
      .call();

    const contract = new web3.eth.Contract(this.pancakeswapPairAbi, pairAddress);
    const token0 = await contract.methods.token0().call();
    contract.addressOrderReversed = token0.toLowerCase() !== address0.toLowerCase();
    return contract;
  };

  // Price is reserve1/reserve0. However, sometimes we want to take the average of all of the pairs in the
  // event there are multiple liquidity pools. This helps in those cases.
  getAveragedPriceFromReserves = function (callContractAndResultList) {
    const reserve0 = callContractAndResultList
      .reduce(
        (a, b) => a.plus(new BigNumber(b.result[b.contract.addressOrderReversed ? "1" : "0"])),
        new BigNumber(0)
    );
    const reserve1 = callContractAndResultList
      .reduce(
        (a, b) => a.plus(new BigNumber(b.result[b.contract.addressOrderReversed ? "0" : "1"])),
        new BigNumber(0)
    );
    return reserve1.dividedBy(reserve0);
  };

  // web3.eth.BatchRequest allows us to batch requests, but each of the requests
  // have their own callback and return individually. It makes it a little hard to manage like this.
  // This is just a Promise that returns the entire result once they've all completed.
  batchCalls = function (callAndContractList) {
    return new Promise((resolve, reject) => {
      let operations = callAndContractList.map((c) => ({
        call: c.call,
        contract: c.contract,
        completed: false,
        result: null,
      }));

      const callback = function (callAndContract, error, response) {
        if (error) {
          reject(error);
        }

        const currentOperation = operations.find((c) => c.call === callAndContract.call);
        currentOperation.completed = true;
        currentOperation.result = response;

        if (operations.every((o) => o.completed)) {
          resolve(operations);
        }
      };

      let batch = new web3.eth.BatchRequest();
      callAndContractList.forEach((cc) => {
        batch.add(cc.call.call.request((e, r) => callback(cc, e, r)));
      });

      batch.execute();
    });
  };

  getLatestPrice = async function () {
    const reservesResultsA = await this.batchCalls(
      this.contractPairsA.map((cp) => ({call: cp.methods.getReserves(), contract: cp }))
    );

    const reservesResultsB = await this.batchCalls(
      this.contractPairsB.map((cp) => ({call: cp.methods.getReserves(), contract: cp }))
    );

    // Calculate average price for Riskmoon/BNB pair from reserves for PCS V1/V2
    const pairPriceA = this.getAveragedPriceFromReserves(reservesResultsA);

    // Calculate average price for BNB/USDT pair from reserves for PCS V1/V2
    const pairPriceB = this.getAveragedPriceFromReserves(reservesResultsB);

    // Multiply pair A by pair B to get the USD value
    let price = pairPriceA.multipliedBy(pairPriceB);

    // number is still a whole number, apply the proper decimal places from the contract (9)
    return price.dividedBy(Math.pow(10, this.riskmoonDecimals));
  };
}

module.exports.RiskmoonPrice = RiskmoonPrice;
module.exports.RiskmoonStats = RiskmoonStats;
