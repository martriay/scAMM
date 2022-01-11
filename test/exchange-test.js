const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");

const { provider } = waffle;
const totalSupply = ethers.utils.parseEther("10000");
const amountA = ethers.utils.parseEther("2000");
const amountB = ethers.utils.parseEther("1000");

let token;
let exchange;
let rewardsToken;
let rewards;

let deployer, bob, alice;

describe("Exchange", function () {
  beforeEach(async function () {
    [deployer, bob, alice] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("Token");
    token = await Token.deploy("Ferneth", "FTH", totalSupply);
    await token.deployed();

    const Exchange = await ethers.getContractFactory("Exchange");
    exchange = await Exchange.deploy(token.address)

    // Deploy otro ERC-20 para dar rewards
    rewardsToken = await Token.deploy("FreeMoney", "F$$", totalSupply);
    await rewardsToken.deployed();

    // Deploy el contrato de rewards 
    const Rewards = await ethers.getContractFactory("StakingRewards");
    rewards = await Rewards.deploy(exchange.address, rewardsToken.address)

    // Manda todos los rewardsToken al contrato de rewards
    const deployerRewardsTokens = await rewardsToken.balanceOf(deployer.address)
    await rewardsToken.approve(rewards.address, deployerRewardsTokens)
    await rewards.depositRewardsTokens(deployerRewardsTokens)

  });

  it("add liquidity", async function () {
    await token.approve(exchange.address, amountA);
    await exchange.addLiquidity(amountA, { value: amountB });

    expect(await exchange.balanceOf(deployer.address)).to.equal(ethers.utils.parseUnits("1000"));
    expect(await provider.getBalance(exchange.address)).to.equal(amountB);
    expect(await exchange.getReserve()).to.equal(amountA);
  });

  it("Verificar StakingRewards.sol (rewards) fue deployed correctamente", async function () {

    expect(await rewards.stakingToken()).to.equal(exchange.address);
    expect(await rewards.rewardsToken()).to.equal(rewardsToken.address);
    expect(await rewardsToken.balanceOf(deployer.address)).to.equal(0);
    expect(await rewardsToken.balanceOf(rewards.address)).to.equal(ethers.utils.parseUnits("10000"));

  });

  it("Stake exchange tokens (LP) y recibir rewards", async () => {
    await token.approve(exchange.address, amountA);
    await exchange.addLiquidity(amountA, { value: amountB });

    let tokens_to_be_staked = await exchange.balanceOf(deployer.address)
    await exchange.approve(rewards.address, tokens_to_be_staked);
    await rewards.stake(tokens_to_be_staked)

    expect(await exchange.balanceOf(rewards.address)).to.equal(tokens_to_be_staked);
    expect(parseInt(await rewards.rewardPerToken())).to.equal(0);

    // simular 20 bloques
    let numberOfBlocks = 20
    for (let i = 0; i < numberOfBlocks; i++) {
      await ethers.provider.send("evm_increaseTime", [60]); // 60 segunods
      await ethers.provider.send("evm_mine", []); // add 60 secs
    }

    // ver staking rewards
    console.log(`    STAKING REWARDS (${numberOfBlocks} bloques):\n    > rewardsPerToken: ${parseInt(await rewards.rewardPerToken())}\n    > earned: ${parseInt(await rewards.earned(deployer.address))}`)


    expect(parseInt(await rewards.rewardPerToken())).to.equal(120);
    expect(parseInt(await rewards.earned(deployer.address))).equal(120000);

    await rewards.withdraw(tokens_to_be_staked)
    expect(await exchange.balanceOf(rewards.address)).to.equal(0);

    await rewards.getReward() 
    expect(await rewardsToken.balanceOf(deployer.address)).to.equal(120000);

    // by Kayaba_Attribution 

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

    //await network.provider.send("evm_increaseTime", [3600])
    //await network.provider.send("evm_mine")

    let bar = await exchange.getEthAmount(ethers.utils.parseEther("2"));

    expect(ethers.utils.formatEther(bar)).to.eq("0.989020869339354039");

    bar = await exchange.getEthAmount(ethers.utils.parseEther("100"));
    expect(ethers.utils.formatEther(bar)).to.eq("47.16531681753215817");

    bar = await exchange.getEthAmount(ethers.utils.parseEther("2000"));
    expect(ethers.utils.formatEther(bar)).to.eq("497.487437185929648241");
  });
});
