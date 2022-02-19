const { expect } = require("chai");
const { ethers } = require("hardhat");
 
const totalSupply = ethers.utils.parseEther("10000");
const amountA = ethers.utils.parseEther("2000");
const amountB = ethers.utils.parseEther("1000");
let token;
let exchange;

let deployer, bob, alice;

describe("Exchange", function () {
  beforeEach(async function () {
    [deployer, bob, alice] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("Token");
    token = await Token.deploy("Ferneth", "FTH", totalSupply);
    await token.deployed();

    const Exchange = await ethers.getContractFactory("Exchange");
    exchange = await Exchange.deploy(token.address)
  });

  it("add liquidity", async function () {
    await token.approve(exchange.address, amountA);
    const tx = exchange.addLiquidity(amountA, { value: amountB });
    
    // el orden del testeo es importante, al cambiarlo falla waffle :S
    await expect(() => tx)
      .to.changeTokenBalances(token, [deployer, exchange], [amountA.mul("-1"), amountA]);

    await expect(await tx)
      .to.changeEtherBalances([deployer, exchange], [amountB.mul("-1"), amountB])
      .to.emit(exchange, "AddLiquidity").withArgs(deployer.address, amountB, amountA);

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

  it("should remove liquidity", async () => {
    token.transfer(bob.address, totalSupply);
    token.connect(bob).approve(exchange.address, totalSupply);
    let tx = exchange.connect(bob).addLiquidity(amountA, { value: amountB });

    // el orden del testeo es importante, al cambiarlo falla waffle :S
    await expect(() => tx)
      .to.changeTokenBalances(token, [bob, exchange], [amountA.mul("-1"), amountA]);

    await expect(await tx)
      .to.changeEtherBalances([bob, exchange], [amountB.mul("-1"), amountB])
      .to.emit(exchange, "AddLiquidity").withArgs(bob.address, amountB, amountA);

    const lpTokenAmount = await exchange.balanceOf(bob.address);
  
    tx = exchange.connect(bob).removeLiquidity(lpTokenAmount);
    
    await expect(() => tx)
      .to.changeTokenBalances(token, [exchange, bob], [amountA.mul("-1"), amountA]);

    await expect(await tx)
      .to.changeEtherBalances([exchange, bob], [amountB.mul("-1"), amountB])
      .to.emit(exchange, "RemoveLiquidity").withArgs(bob.address, amountB, amountA);
  });

  it("returns correct eth price", async () => {
    await token.approve(exchange.address, amountA);
    tx = exchange.addLiquidity(amountA, { value: amountB });
    await expect(tx).to.emit(exchange, "AddLiquidity")
      .withArgs(deployer.address, amountB, amountA);


    // let amount = ethers.utils.parseEther("2");
    let bar = await exchange.getEthAmount(ethers.utils.parseEther("2"));

    // let inputAmountWithFee = amount.mul(99);
    // let numerator = inputAmountWithFee.mul(amountB);
    // let denominator = amountA.mul(100).add(inputAmountWithFee);
    // let expected = numerator.div(denominator);
    // console.log(ethers.utils.formatEther(expected));

    expect(ethers.utils.formatEther(bar)).to.eq("0.989020869339354039");
    
    bar = await exchange.getEthAmount(ethers.utils.parseEther("100"));
    expect(ethers.utils.formatEther(bar)).to.eq("47.16531681753215817");

    bar = await exchange.getEthAmount(ethers.utils.parseEther("2000"));
    expect(ethers.utils.formatEther(bar)).to.eq("497.487437185929648241");
  });

  it("swap eth into token", async () => {
    await token.approve(exchange.address, amountA);
    tx = exchange.addLiquidity(amountA, { value: amountB });
    await expect(tx).to.emit(exchange, "AddLiquidity")
      .withArgs(deployer.address, amountB, amountA);

    const expectedOutputForBob = await exchange.getEthAmount(ethers.utils.parseEther("2"));
    tx = await exchange.connect(bob).ethToTokenSwap(expectedOutputForBob, { value: ethers.utils.parseEther("2") });

    await expect(tx).to.emit(exchange, "TokenPurchase");
  
    // revisar estos valores
    // expect(await token.balanceOf(bob.address)).to.eq(expectedOutputForBob)
    
    const expectedOutputForAlice = await exchange.getEthAmount(ethers.utils.parseEther("2"));
    tx = await exchange.connect(alice).ethToTokenSwap(expectedOutputForAlice, { value: ethers.utils.parseEther("2") });

    await expect(tx).to.emit(exchange, "TokenPurchase");
    // // revisar estos valores
    // expect(await token.balanceOf(alice.address)).to.eq(expectedOutputForAlice);
  });
});
