const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");

const { provider } = waffle;
const totalSupply = ethers.utils.parseEther("10000");
const amountA = ethers.utils.parseEther("2000");
const amountB = ethers.utils.parseEther("1000");
let token;
let exchange;

let tx;

let deployer, bob, alice;

describe("Liquidity", function () {
  before(async function () {
    [deployer, bob, alice] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("Token");
    token = await Token.deploy("Ferneth", "FTH", totalSupply);
    await token.deployed();

    const Exchange = await ethers.getContractFactory("Exchange");
    exchange = await Exchange.deploy(token.address)
  });

  /**
   * Agrega amountA del token FTH y amountB de ETH
   * Como es la primera vez que se agrega liquidez, el
   * valor del LP minteado es amountB
   */
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


  /**
   * Agrego las mismas proporciones de FTH y ETH que en el caso anterior
   * Por lo que las cantidades deberian ser el doble y con la misma proporcion
   */
  it("add more liquidity", async function () {
    await token.approve(exchange.address, amountA);
    const tx = exchange.addLiquidity(amountA, { value: amountB });
    /*
    // el orden del testeo es importante, al cambiarlo falla waffle :S
    en vez de esto uso el evento transfer del token, como es mio puedo confiar en el token
    y en que si emite el evento transfer, es porque se modificaron los balances
    await expect(tx)
      .to.changeTokenBalances(token, [deployer, exchange], [amountA.mul("-1"), amountA]);
    */
    await expect(await tx)
      .to.changeEtherBalances([deployer, exchange], [amountB.mul("-1"), amountB])
      .to.emit(exchange, "AddLiquidity").withArgs(deployer.address, amountB, amountA)
      .to.emit(token, "Transfer").withArgs(deployer.address, exchange.address, amountA);
      
      
    expect(await provider.getBalance(exchange.address)).to.equal(amountB.mul("2"));
    expect(await exchange.getReserve()).to.equal(amountA.mul("2"));
    expect(await exchange.balanceOf(deployer.address)).to.equal(amountB.mul("2"));
  });
});