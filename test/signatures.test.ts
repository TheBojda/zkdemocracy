import { describe, expect, test, afterAll } from '@jest/globals';
import { personalSign } from "@metamask/eth-sig-util";
import { Wallet, verifyMessage, encodeBase64, toUtf8Bytes, decodeBase64, toUtf8String } from "ethers";
import { signMessageWithNonce, verifyAndExtractMessage, getNonce } from "../src/utils/ethereum_utils"
import { pool } from "../src/utils/db_utils"

const ADMIN_ADDRESS = "0x1C7bcE0821f78F952308F222E5d911312CA10400";
const ADMIN_PRIVATE_KEY = "0xb16ee57cb3c497cab8aebf284ac19bb594f7a253077c3b0c15fc8ba44b6325a5";

describe("Testing Ethereum signing and verification", () => {

    afterAll(async () => {
        await pool.end();
    });

    test("Sign and verify message", () => {
        const wallet = Wallet.createRandom();
        const message = "Hello, this is a test message";

        const metamaskSignature = personalSign({ privateKey: Buffer.from(wallet.privateKey.slice(2), 'hex'), data: message })
        const ethersSignature = wallet.signMessageSync(message)
        expect(metamaskSignature).toBe(ethersSignature);

        const address = verifyMessage(message, ethersSignature)
        expect(address).toBe(wallet.address);
    })

    test("JSON signing and verify", () => {
        const content = {
            foo: 123,
            bar: 456
        }

        const wallet = Wallet.createRandom();

        const base64content = encodeBase64(toUtf8Bytes(JSON.stringify(content)))
        const signature = wallet.signMessageSync(base64content)
        const envelope = {
            content: base64content,
            signature: signature,
            address: wallet.address
        }

        const address = verifyMessage(envelope.content, envelope.signature)
        expect(address).toBe(envelope.address)

        const parsed_content = JSON.parse(toUtf8String(decodeBase64(envelope.content)))
        expect(JSON.stringify(parsed_content)).toBe(JSON.stringify(content))
    })

    test("Sign and verify with Ethereum utils", async () => {
        const message = {
            foo: 123,
            bar: 456
        }

        const nonce = await getNonce(ADMIN_ADDRESS);
        const payload = await signMessageWithNonce(message, ADMIN_PRIVATE_KEY, nonce)
        const [extractedMessage, address] = await verifyAndExtractMessage(payload);

        expect(JSON.stringify(extractedMessage)).toBe(JSON.stringify(message))
        expect(address).toBe(ADMIN_ADDRESS)
    })

});