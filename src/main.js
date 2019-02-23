import "babel-polyfill";

import Web3 from 'web3';

import Contracts from "./contracts";


console.log("\r");

const KEY_PURPOSES = {
  "MANAGEMENT" : 1,
  "CLAIM" : 3,
};
const KEY_TYPES = {
  "ECDSA" : 1
};
const CLAIM_SCHEMES = {
  "ECDSA" : 1
};
const CLAIM_TYPES = {
  "TWOWHEELER" : 7
};

var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
Contracts.init(web3);

(async () => {
  /*
   * compiling contracts
   */

  var accounts = await web3.eth.personal.getAccounts();
  var DLManagementAccount = accounts[0];
  var DLClaimAccount = accounts[1];
  var govAccount = accounts[2];
  var driverAccount = accounts[3];

  console.log("Compiling contracts...");

  var jsonClaimHolder = Contracts.compileClaimHolder();
  var jsonDLverification = Contracts.compileDLVerification();


  /*
   * Driving Licence Management Org deploys own ClaimHolder contract
   */

  console.log("Deploying DL Manager's ClaimHolder...");

  var DLClaimHolder = await Contracts.deploy(
    "ClaimHolder",
    jsonClaimHolder,
    DLManagementAccount,
  );


  /*
   * Driving Licence Management Org adds claim key on its ClaimHolder
   */

  console.log("Adding a claim key to DL Management's ClaimHolder...");

  var DLClaimKey = web3.utils.keccak256(DLClaimAccount);
  await DLClaimHolder.methods.addKey(
    DLClaimKey,
    KEY_PURPOSES.CLAIM,
    KEY_TYPES.ECDSA,
  ).send({
    from: DLManagementAccount,
    gas: 4612388,
  });


  /*
   * Driver deploys their ClaimHolder contract
   */

  console.log("Deploying Driver's ClaimHolder...");

  var driverClaimHolder = await Contracts.deploy(
    "ClaimHolder",
    jsonClaimHolder,
    driverAccount,
  );


  /*
   * DL org signs a claim for driver to add to their ClaimHolder
   */

  console.log("Signing dl's claim...");

  var hexedData = web3.utils.asciiToHex("Hell yes, he can fly aeroplanes too!");
  var hashedDataToSign = web3.utils.soliditySha3(
    driverClaimHolder.options.address,
    CLAIM_TYPES.TWOWHEELER,
    hexedData,
  );
  var signature = await web3.eth.sign(hashedDataToSign, DLClaimAccount);


  /*
   * Driver adds DL's claim to own ClaimHolder
   */

  console.log("Adding Two wheeler's DL claim on driver's ClaimHolder...");

  var claimIssuer = DLClaimHolder.options.address;
  var addClaimABI = await driverClaimHolder.methods
    .addClaim(
      CLAIM_TYPES.TWOWHEELER,
      CLAIM_SCHEMES.ECDSA,
      claimIssuer,
      signature,
      hexedData,
      "https://www.drivinglicencecommittee.org",
    ).encodeABI();

  await driverClaimHolder.methods.execute(
    driverClaimHolder.options.address,
    0,
    addClaimABI,
  ).send({
    gas: 4612388,
    from: driverAccount,
  });
  /*
   * Two Wheeler validation contracts gets deployed
   */

  console.log("Government deploying Two Wheeler validation contract...");
  var twoWheeler = await Contracts.deploy(
    "TwoWheeler",
    jsonDLverification,
    govAccount,
    [DLClaimHolder.options.address],
  );


  /*
   * Driver shows Claim
   */

  console.log("Driver tries to claim to police , who will check for the TWO WHEELER claim...");

  var driveABI = twoWheeler.methods.Validate(
    driverClaimHolder.options.address
  ).encodeABI();

  await driverClaimHolder.methods.execute(
   twoWheeler.options.address,
   0,
   driveABI,
 ).send({
   gas: 4612388,
   from: driverAccount,
});

console.log("OK! ", await twoWheeler.methods.getAuth(driverClaimHolder.options.address).call());

})()
