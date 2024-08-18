import { runQuery } from './db_utils'
import { Wallet, verifyMessage, encodeBase64, toUtf8Bytes, decodeBase64, toUtf8String } from "ethers";

export async function getNonce(address: string) {
    const rows = await runQuery("SELECT nonce FROM nonces WHERE address=?", [address]);
    if (rows.length > 0)
        return rows[0].nonce.toString();
    return '0';
}

export async function incrementNonce(address: string) {
    await runQuery("INSERT INTO nonces (address, nonce) VALUES (?, 1) ON DUPLICATE KEY UPDATE nonce = nonce + 1", [address]);
}

export async function verifyAndExtractMessage(payload: { content: string, signature: string, address: string }) {
    if (!payload.content)
        throw new Error("No content defined!")

    if (!payload.signature)
        throw new Error("No signature defined!")

    if (!payload.signature)
        throw new Error("No address defined!")

    const extractedAddress = verifyMessage(payload.content, payload.signature);
    if (payload.address != extractedAddress)
        throw new Error("Signature error!")

    const nonce = await getNonce(payload.address);
    const [base64nonce, base64message] = payload.content.split('.', 2);
    const extractedNonce = toUtf8String(decodeBase64(base64nonce));
    if (extractedNonce != nonce)
        throw new Error("Nonce error!")

    await incrementNonce(payload.address);

    const message = JSON.parse(toUtf8String(decodeBase64(base64message)));
    return [message, payload.address];
}

export async function signMessageWithNonce(message: any, privateKey: string, nonce: string) {
    const wallet = new Wallet(privateKey);
    const base64message = encodeBase64(toUtf8Bytes(JSON.stringify(message)))
    const base64nonce = encodeBase64(toUtf8Bytes(nonce.toString()))
    const content = base64nonce + '.' + base64message;
    const signature = wallet.signMessageSync(content);
    return {
        content: content,
        signature: signature,
        address: wallet.address
    }
}