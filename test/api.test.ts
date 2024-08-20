import { describe, expect, test, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import { api } from '../src/api'
import { pool } from "../src/utils/db_utils"
import { signMessageWithNonce, verifyAndExtractMessage } from "../src/utils/ethereum_utils"
import { uuidToHex } from "../src/utils/conversion_utils"
import { rebuildGroupFromDB, clearGroupCache, rebuildGroup } from "../src/services/group_management_service"
import { Identity, generateProof } from "@semaphore-protocol/core"

const ADMIN_ADDRESS = "0x1C7bcE0821f78F952308F222E5d911312CA10400";
const ADMIN_PRIVATE_KEY = "0xb16ee57cb3c497cab8aebf284ac19bb594f7a253077c3b0c15fc8ba44b6325a5";

const GROUP_ADMIN_ADDRESS = "0xeE0b7Fd9a188ABf7908B9441c15dc303C2b84740";
const GROUP_ADMIN_PRIVATE_KEY = "0xc0df6cc284a1f4c7ffd1bcdc3aaf0e1181e04ae4767b630541465ec12482e717";

const SERVER_ADDRESS = "0xA3F12e07Bd15439E2A253b6DB0a4131a56058817";

describe("Testing the API", () => {

    afterAll(async () => {
        await pool.end();
    });

    let group_uuid: string;
    let voting_uuid: string;
    let identity: Identity;

    test("Add group", async () => {
        const message = {
            path: '/groups/add',
            group_name: "Test group"
        }

        const nonce = (await request(api).get(`/nonces/${ADMIN_ADDRESS}`)).body.nonce;
        const payload = await signMessageWithNonce(message, ADMIN_PRIVATE_KEY, nonce)
        const res = await request(api)
            .post('/groups/add')
            .send(payload)

        if (res.status !== 200)
            console.error(`Error: Expected status 200, but got ${res.status}, error: ${res.text}`);

        expect(res.status).toBe(200)

        const [extractedMessage, address] = await verifyAndExtractMessage(res.body);
        expect(address).toBe(SERVER_ADDRESS);
        expect(extractedMessage.creator).toBe(ADMIN_ADDRESS)

        group_uuid = extractedMessage.uuid
    });

    test("Add group admin", async () => {
        const message = {
            path: `/groups/${group_uuid}/admins/add`,
            group_admin: GROUP_ADMIN_ADDRESS
        }

        const nonce = (await request(api).get(`/nonces/${ADMIN_ADDRESS}`)).body.nonce;
        const payload = await signMessageWithNonce(message, ADMIN_PRIVATE_KEY, nonce)
        const res = await request(api)
            .post(`/groups/${group_uuid}/admins/add`)
            .send(payload)

        if (res.status !== 200)
            console.error(`Error: Expected status 200, but got ${res.status}, error: ${res.text}`);

        const [extractedMessage, address] = await verifyAndExtractMessage(res.body);
        expect(address).toBe(SERVER_ADDRESS);
        expect(extractedMessage.creator).toBe(ADMIN_ADDRESS)
        expect(extractedMessage.group_admin).toBe(GROUP_ADMIN_ADDRESS)
    })

    test("Add voting", async () => {
        const message = {
            path: '/votings/add',
            voting_name: "Test voting"
        }

        const nonce = (await request(api).get(`/nonces/${ADMIN_ADDRESS}`)).body.nonce;
        const payload = await signMessageWithNonce(message, ADMIN_PRIVATE_KEY, nonce)
        const res = await request(api)
            .post('/votings/add')
            .send(payload)

        if (res.status !== 200)
            console.error(`Error: Expected status 200, but got ${res.status}, error: ${res.text}`);

        expect(res.status).toBe(200)

        const [extractedMessage, address] = await verifyAndExtractMessage(res.body);
        expect(address).toBe(SERVER_ADDRESS);
        expect(extractedMessage.creator).toBe(ADMIN_ADDRESS)

        voting_uuid = extractedMessage.uuid
    })


    test("Assign voting to group", async () => {
        const message = {
            path: `/votings/${voting_uuid}/groups/add`,
            group_uuid: group_uuid
        }

        const nonce = (await request(api).get(`/nonces/${ADMIN_ADDRESS}`)).body.nonce;
        const payload = await signMessageWithNonce(message, ADMIN_PRIVATE_KEY, nonce)
        const res = await request(api)
            .post(`/votings/${voting_uuid}/groups/add`)
            .send(payload)

        if (res.status !== 200)
            console.error(`Error: Expected status 200, but got ${res.status}, error: ${res.text}`);

        const [extractedMessage, address] = await verifyAndExtractMessage(res.body);
        expect(address).toBe(SERVER_ADDRESS);
        expect(extractedMessage.creator).toBe(ADMIN_ADDRESS)
    })

    test("Add members to group", async () => {
        for (let i = 0; i < 10; i++) {
            const identity = new Identity()

            const message = {
                path: `/groups/${group_uuid}/members/add`,
                commitment: identity.commitment.toString(),
                identity_hash: identity.commitment.toString(), // in real world apps, use real identity hash like number if ID card, etc.
                proof: 'proof',
            }

            const nonce = (await request(api).get(`/nonces/${ADMIN_ADDRESS}`)).body.nonce;
            const payload = await signMessageWithNonce(message, ADMIN_PRIVATE_KEY, nonce)
            const res = await request(api)
                .post(`/groups/${group_uuid}/members/add`)
                .send(payload)

            if (res.status !== 200)
                console.error(`Error: Expected status 200, but got ${res.status}, error: ${res.text}`);

            await expect(rebuildGroupFromDB(group_uuid)).resolves.not.toThrow();
        }
    })

    test("Add new members to group", async () => {
        clearGroupCache(group_uuid)

        for (let i = 0; i < 10; i++) {
            const identity = new Identity()

            const message = {
                path: `/groups/${group_uuid}/members/add`,
                commitment: identity.commitment.toString(),
                identity_hash: identity.commitment.toString(), // in real world apps, use real identity hash like number if ID card, etc.
                proof: 'proof',
            }

            const nonce = (await request(api).get(`/nonces/${ADMIN_ADDRESS}`)).body.nonce;
            const payload = await signMessageWithNonce(message, ADMIN_PRIVATE_KEY, nonce)
            const res = await request(api)
                .post(`/groups/${group_uuid}/members/add`)
                .send(payload)

            if (res.status !== 200)
                console.error(`Error: Expected status 200, but got ${res.status}, error: ${res.text}`);

            await expect(rebuildGroupFromDB(group_uuid)).resolves.not.toThrow();
        }
    })

    test("List group members and check root", async () => {
        const res = await request(api).get(`/groups/${group_uuid}/members`)

        if (res.status !== 200)
            console.error(`Error: Expected status 200, but got ${res.status}, error: ${res.text}`);

        const [extractedMessage, address] = await verifyAndExtractMessage(res.body);

        expect(extractedMessage.group_uuid).toBe(group_uuid)

        let group;
        expect(() => {
            group = rebuildGroup(extractedMessage.members);
        }).not.toThrow();

        const root = (await request(api).get(`/groups/${group_uuid}/root`)).body.root;
        expect(root).toBe(group.root.toString())
    })

    test("Check merkle proof generation", async () => {
        identity = new Identity()

        // add element
        const message = {
            path: `/groups/${group_uuid}/members/add`,
            commitment: identity.commitment.toString(),
            identity_hash: identity.commitment.toString(), // in real world apps, use real identity hash like number if ID card, etc.
            proof: 'proof',
        }

        const nonce = (await request(api).get(`/nonces/${ADMIN_ADDRESS}`)).body.nonce;
        const payload = await signMessageWithNonce(message, ADMIN_PRIVATE_KEY, nonce)
        await request(api)
            .post(`/groups/${group_uuid}/members/add`)
            .send(payload)

        // generate merkle proof
        const res = await request(api).get(`/groups/${group_uuid}/members/${identity.commitment}/merkle_proof`)
        const merkle_proof = res.body.merkle_proof

        const root = (await request(api).get(`/groups/${group_uuid}/root`)).body.root;
        expect(root).toBe(merkle_proof.root)
        expect(identity.commitment.toString()).toBe(merkle_proof.leaf)
    })

    test("Cast a vote", async () => {
        const merkle_proof_res = await request(api).get(`/groups/${group_uuid}/members/${identity.commitment}/merkle_proof`)
        const merkle_proof = merkle_proof_res.body.merkle_proof
        const scope = uuidToHex(voting_uuid)
        const proof = await generateProof(identity, merkle_proof, 1, scope) // jest don't exit because of generateProof :(

        const message = {
            group_uuid: group_uuid,
            proof: proof
        }

        const res = await request(api)
            .post(`/votings/${voting_uuid}/vote`)
            .send(message)

        if (res.status !== 200)
            console.error(`Error: Expected status 200, but got ${res.status}, error: ${res.text}`);

        const [extractedMessage, address] = await verifyAndExtractMessage(res.body);

        expect(address).toBe(SERVER_ADDRESS)
        expect(extractedMessage.voting_uuid).toBe(voting_uuid)
    })
})