import { Wallet } from "ethers";

const wallet = Wallet.createRandom();
console.log("address:", wallet.address);
console.log("private key:", wallet.privateKey)