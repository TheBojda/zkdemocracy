import fetch from 'node-fetch';
import { Wallet, verifyMessage, encodeBase64, toUtf8Bytes, decodeBase64, toUtf8String } from "ethers";
import { Identity, generateProof } from "@semaphore-protocol/core"
import { getCurveFromName } from "ffjavascript"

const ADMIN_ADDRESS = "0x1C7bcE0821f78F952308F222E5d911312CA10400";
const ADMIN_PRIVATE_KEY = "0xb16ee57cb3c497cab8aebf284ac19bb594f7a253077c3b0c15fc8ba44b6325a5";

const BASE_URL = "http://localhost:3000";

async function signMessageWithNonce(message: any, privateKey: string, nonce: string) {
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

async function verifyAndExtractMessage(payload: { content: string, signature: string, address: string }) {
    if (!payload.content)
        throw new Error("No content defined!")

    if (!payload.signature)
        throw new Error("No signature defined!")

    if (!payload.signature)
        throw new Error("No address defined!")

    const extractedAddress = verifyMessage(payload.content, payload.signature);
    if (payload.address != extractedAddress)
        throw new Error("Signature error!")

    const [_, base64message] = payload.content.split('.', 2);

    const message = JSON.parse(toUtf8String(decodeBase64(base64message)));
    return message;
}

async function postData(url: string, data: object): Promise<any> {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const result = await response.text()
            throw new Error(`Error! status: ${response.status} message: ${result}`);
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error making POST request:', error);
        throw error;
    }
}

let nonce: number;

async function callEndpoint(path: string, data: any) {
    const res = await postData(`${BASE_URL}${path}`, await signMessageWithNonce(
        data, ADMIN_PRIVATE_KEY, nonce.toString()
    ))
    nonce++
    return await verifyAndExtractMessage(res)
}

export function uuidToHex(uuid: string): string {
    const hexString = uuid.replace(/-/g, '');
    return `0x${hexString}`;
}

async function main() {
    const response = await (await fetch(`${BASE_URL}/nonces/${ADMIN_ADDRESS}`)).json()
    nonce = Number(response.nonce)

    const voting = await callEndpoint("/votings/add", {
        path: "/votings/add",
        voting_name: "Test voting"
    })
    console.log(voting)

    const group = await callEndpoint("/groups/add", {
        path: "/groups/add",
        group_name: "Test group"
    })
    console.log(group)

    const voting_group_assignment = await callEndpoint(`/votings/${voting.uuid}/groups/add`, {
        path: `/votings/${voting.uuid}/groups/add`,
        group_uuid: group.uuid
    })
    console.log(voting_group_assignment)

    const identity = new Identity()

    const add_member = await callEndpoint(`/groups/${group.uuid}/members/add`, {
        path: `/groups/${group.uuid}/members/add`,
        commitment: identity.commitment.toString(),
        identity_hash: identity.commitment.toString(), // in real world apps, use real identity hash like number if ID card, etc.
        proof: "proof of identification"
    })
    console.log(add_member)

    const mp = await (await fetch(`${BASE_URL}/groups/${group.uuid}/members/${identity.commitment.toString()}/merkle_proof`)).json()
    console.log(mp)

    const proof = await generateProof(identity, mp.merkle_proof, 1, uuidToHex(voting.uuid))

    const vote = await postData(`${BASE_URL}/votings/${voting.uuid}/vote`, {
        group_uuid: group.uuid,
        proof
    })
    console.log(vote)

    // process.exit(0)

    const curve = await getCurveFromName("bn128")
    curve.terminate()
}

main();