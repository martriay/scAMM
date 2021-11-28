const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");

const { provider } = waffle;
const totalSupply = ethers.utils.parseEther("10000");
const amountA = ethers.utils.parseEther("2000");
const amountB = ethers.utils.parseEther("1000");
let token;
let exchange;

describe("Exchange", function () {
  beforeEach(async function () {
    const Token = await ethers.getContractFactory("Token");
    token = await Token.deploy("Ferneth", "FTH", totalSupply);
    await token.deployed();

    const Exchange = await ethers.getContractFactory("Exchange");
    exchange = await Exchange.deploy(token.address)
  });

  it("add liquidity", async function () {
    await token.approve(exchange.address, amountA);
    await exchange.addLiquidity(amountA, { value: amountB });

    expect(await provider.getBalance(exchange.address)).to.equal(amountB);
    expect(await exchange.getReserve()).to.equal(amountA);
  });

  it("returns correct token price", async () => {
    // await token.approve(exchange.address, amountA);
    // await exchange.addLiquidity(amountA, { value: amountB });

    // let bar = await exchange.getTokenAmount(ethers.utils.parseEther("1"));
    // expect(ethers.utils.formatEther(bar)).to.eq("1.998001998001998001");

    // bar = await exchange.getTokenAmount(ethers.utils.parseEther("100"));
    // expect(ethers.utils.formatEther(bar)).to.eq("181.818181818181818181");

    // bar = await exchange.getTokenAmount(ethers.utils.parseEther("1000"));
    // expect(ethers.utils.formatEther(bar)).to.eq("1000.0");
  });

  it("returns correct eth price", async () => {
    await token.approve(exchange.address, amountA);
    await exchange.addLiquidity(amountA, { value: amountB });

    let bar = await exchange.getEthAmount(ethers.utils.parseEther("2"));
    expect(ethers.utils.formatEther(bar)).to.eq("0.999000999000999");

    bar = await exchange.getEthAmount(ethers.utils.parseEther("100"));
    expect(ethers.utils.formatEther(bar)).to.eq("47.619047619047619047");

    bar = await exchange.getEthAmount(ethers.utils.parseEther("2000"));
    expect(ethers.utils.formatEther(bar)).to.eq("500.0");
  });
});
