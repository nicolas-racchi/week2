// [assignment] please copy the entire modified custom.test.js here
const hre = require("hardhat");
const { ethers, waffle } = hre;
const { loadFixture } = waffle;
const { expect } = require("chai");
const { utils } = ethers;

const Utxo = require("../src/utxo");
const { transaction, prepareTransaction } = require("../src/index");
const { Keypair } = require("../src/keypair");
const { encodeDataForBridge } = require("./utils");

const MERKLE_TREE_HEIGHT = 5;
const l1ChainId = 1;
const MINIMUM_WITHDRAWAL_AMOUNT = utils.parseEther(
  process.env.MINIMUM_WITHDRAWAL_AMOUNT || "0.05"
);
const MAXIMUM_DEPOSIT_AMOUNT = utils.parseEther(
  process.env.MAXIMUM_DEPOSIT_AMOUNT || "1"
);

describe("Custom Tests", function () {
  this.timeout(20000);

  async function deploy(contractName, ...args) {
    const Factory = await ethers.getContractFactory(contractName);
    const instance = await Factory.deploy(...args);
    return instance.deployed();
  }

  async function fixture() {
    require("../scripts/compileHasher");
    const [sender, gov, l1Unwrapper, multisig] = await ethers.getSigners();
    const verifier2 = await deploy("Verifier2");
    const verifier16 = await deploy("Verifier16");
    const hasher = await deploy("Hasher");

    const token = await deploy(
      "PermittableToken",
      "Wrapped ETH",
      "WETH",
      18,
      l1ChainId
    );
    await token.mint(sender.address, utils.parseEther("10000"));

    const amb = await deploy("MockAMB", gov.address, l1ChainId);
    const omniBridge = await deploy("MockOmniBridge", amb.address);

    /** @type {TornadoPool} */
    const tornadoPoolImpl = await deploy(
      "TornadoPool",
      verifier2.address,
      verifier16.address,
      MERKLE_TREE_HEIGHT,
      hasher.address,
      token.address,
      omniBridge.address,
      l1Unwrapper.address,
      gov.address,
      l1ChainId,
      multisig.address
    );

    const { data } = await tornadoPoolImpl.populateTransaction.initialize(
      MINIMUM_WITHDRAWAL_AMOUNT,
      MAXIMUM_DEPOSIT_AMOUNT
    );
    const proxy = await deploy(
      "CrossChainUpgradeableProxy",
      tornadoPoolImpl.address,
      gov.address,
      data,
      amb.address,
      l1ChainId
    );

    const tornadoPool = tornadoPoolImpl.attach(proxy.address);

    await token.approve(tornadoPool.address, utils.parseEther("10000"));

    return { tornadoPool, token, proxy, omniBridge, amb, gov, multisig };
  }

  it("[assignment] ii. deposit 0.1 ETH in L1 -> withdraw 0.08 ETH in L2 -> assert balances", async () => {
    // [assignment] complete code here

    // 1. Alice deposits 0.1 eth in L1
    // 2. Alice sends 0.06 eth in L2
    // 3. Assert recipient, omniBridge, tornadoPool balances

    const { tornadoPool, token, omniBridge } = await loadFixture(fixture);
    const aliceKeypair = new Keypair(); // contains private and public keys

    // 1.
    const aliceDepositAmount = utils.parseEther("0.1");

    const aliceDepositUtxo = new Utxo({
      amount: aliceDepositAmount,
      keypair: aliceKeypair,
    });

    const { args, extData } = await prepareTransaction({
      tornadoPool,
      outputs: [aliceDepositUtxo],
    });

    const onTokenBridgedData = encodeDataForBridge({
      proof: args,
      extData,
    });

    const onTokenBridgedTx =
      await tornadoPool.populateTransaction.onTokenBridged(
        token.address,
        aliceDepositUtxo.amount,
        onTokenBridgedData
      );

    // emulating bridge. first it sends tokens to omnibridge mock then it sends to the pool
    await token.transfer(omniBridge.address, aliceDepositAmount);
    const transferTx = await token.populateTransaction.transfer(
      tornadoPool.address,
      aliceDepositAmount
    );

    // Execute bridged transactions
    await omniBridge.execute([
      { who: token.address, callData: transferTx.data }, // send tokens to pool
      { who: tornadoPool.address, callData: onTokenBridgedTx.data }, // call onTokenBridgedTx
    ]);

    // 2.
    const aliceWithdrawAmount = utils.parseEther("0.08");
    const recipient = "0xDeaD00000000000000000000000000000000BEEf";
    const aliceChangeUtxo = new Utxo({
      amount: aliceDepositAmount.sub(aliceWithdrawAmount),
      keypair: aliceKeypair,
    });

    await transaction({
      tornadoPool,
      inputs: [aliceDepositUtxo],
      outputs: [aliceChangeUtxo],
      recipient: recipient,
    });

    // 3.
    expect(await token.balanceOf(recipient)).to.be.equal(
      utils.parseEther("0.08")
    );
    expect(await token.balanceOf(omniBridge.address)).to.be.equal(0);
    expect(await token.balanceOf(tornadoPool.address)).to.be.equal(
      utils.parseEther("0.02")
    );
  });

  it("[assignment] iii. see assignment doc for details", async () => {
    // [assignment] complete code here

    // 1. alice deposits 0.13 eth in L1
    // 2. alice sends 0.06 eth to Bob in L2
    // 3. Bob withdraws all his funds (0.06 eth) in L2
    // 4. alice withdraws all her remaining funds (0.07 eth) in L1
    // 5. assert alice, bob, omniBridge, tornadoPool balances

    const { tornadoPool, token, omniBridge } = await loadFixture(fixture);
    const aliceKeypair = new Keypair(); // contains private and public keys

    // 1.
    const aliceDepositAmount = utils.parseEther("0.13");

    const aliceDepositUtxo = new Utxo({
      amount: aliceDepositAmount,
      keypair: aliceKeypair,
    });

    const { args, extData } = await prepareTransaction({
      tornadoPool,
      outputs: [aliceDepositUtxo],
    });

    const onTokenBridgedData = encodeDataForBridge({ proof: args, extData });

    const onTokenBridgedTx =
      await tornadoPool.populateTransaction.onTokenBridged(
        token.address,
        aliceDepositUtxo.amount,
        onTokenBridgedData
      );

    // Emulating bridge. first it sends tokens to omnibridge mock then it sends to the pool
    await token.transfer(omniBridge.address, aliceDepositAmount);
    const transferTx = await token.populateTransaction.transfer(
      tornadoPool.address,
      aliceDepositAmount
    );

    // Execute bridged transactions
    await omniBridge.execute([
      { who: token.address, callData: transferTx.data }, // send tokens to pool
      { who: tornadoPool.address, callData: onTokenBridgedTx.data }, // call onTokenBridgedTx
    ]);

    // 2.
    // Bob gives Alice address to send some eth inside the shielded pool
    const bobKeypair = new Keypair(); // contains private and public keys
    const bobAddress = bobKeypair.address(); // contains only public key

    // Alice sends some funds to Bob
    const bobSendAmount = utils.parseEther("0.06");
    const bobSendUtxo = new Utxo({
      amount: bobSendAmount,
      keypair: Keypair.fromString(bobAddress),
    });

    const aliceChangeUtxo = new Utxo({
      amount: aliceDepositAmount.sub(bobSendAmount),
      keypair: aliceDepositUtxo.keypair,
    });
    await transaction({
      tornadoPool,
      inputs: [aliceDepositUtxo],
      outputs: [bobSendUtxo, aliceChangeUtxo],
    });

    // 3.
    const bobWithdrawAmount = utils.parseEther("0.06");
    const bobEthAddress = "0xDeaD00000000000000000000000000000000BEEf";
    const bobChangeUtxo = new Utxo({
      amount: bobWithdrawAmount,
      keypair: bobKeypair,
      blinding: bobSendUtxo.blinding,
    });

    await transaction({
      tornadoPool,
      inputs: [bobChangeUtxo],
      recipient: bobEthAddress,
    });

    // 4.
    const aliceEthAddress = "0x28846f1Ec065eEa239152213373bb58B1C9Fc93B"; // needs to be different from bob's deadbeef
    await transaction({
      tornadoPool,
      inputs: [aliceChangeUtxo], // it's the same UTXO as in 2. because we keep the blinding
      recipient: aliceEthAddress,
      isL1Widhdrawal: true,
    });

    // 5.

    // alice
    expect(await token.balanceOf(aliceEthAddress)).to.be.equal(
      utils.parseEther("0.07")
    );

    // bridge
    expect(await token.balanceOf(omniBridge.address)).to.be.equal(0);

    // bob
    expect(await token.balanceOf(bobEthAddress)).to.be.equal(
      utils.parseEther("0.06")
    );

    // tornado pool
    expect(await token.balanceOf(tornadoPool.address)).to.be.equal(0);
  });
});
