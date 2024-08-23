import { describe, expect, test, afterAll, jest, beforeAll } from '@jest/globals';
import request from 'supertest';
import { api } from '../src/api'
import { pool } from "../src/utils/db_utils"
import { signMessageWithNonce, verifyAndExtractMessage } from "../src/utils/ethereum_utils"
import { uuidToHex } from "../src/utils/conversion_utils"
import { rebuildGroupFromDB, clearGroupCache, rebuildGroup, computeCheckpointHashOfMember } from "../src/services/group_management_service"
import { computeCheckpointHashOfVote } from "../src/services/voting_management_service"
import { Identity, generateProof } from "@semaphore-protocol/core"
import { getCurveFromName } from "ffjavascript"

const ADMIN_ADDRESS = "0x1C7bcE0821f78F952308F222E5d911312CA10400";
const ADMIN_PRIVATE_KEY = "0xb16ee57cb3c497cab8aebf284ac19bb594f7a253077c3b0c15fc8ba44b6325a5";

const GROUP_ADMIN_ADDRESS = "0xeE0b7Fd9a188ABf7908B9441c15dc303C2b84740";
const GROUP_ADMIN_PRIVATE_KEY = "0xc0df6cc284a1f4c7ffd1bcdc3aaf0e1181e04ae4767b630541465ec12482e717";

const SERVER_ADDRESS = "0xA3F12e07Bd15439E2A253b6DB0a4131a56058817";

describe("Testing the API", () => {

    let curve: any

    beforeAll(async () => {
        curve = await getCurveFromName("bn128")
    })

    afterAll(async () => {
        await pool.end()
        await curve.terminate()
    });

    let group_uuid: string;
    let voting_uuid: string;
    let identity_list: Identity[] = [];

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

    test("List group members and check root and checkpoint hash", async () => {
        const res = await request(api).get(`/groups/${group_uuid}/members`)

        if (res.status !== 200)
            console.error(`Error: Expected status 200, but got ${res.status}, error: ${res.text}`);

        const [extractedMessage, address] = await verifyAndExtractMessage(res.body);

        expect(extractedMessage.group_uuid).toBe(group_uuid)

        // recalculate merkle root of the group
        let group;
        expect(() => {
            group = rebuildGroup(extractedMessage.members);
        }).not.toThrow();

        const root = (await request(api).get(`/groups/${group_uuid}/root`)).body.root;
        expect(root).toBe(group.root.toString())

        // recalculate checkpoint hashes
        let prev_checkpoint_hash = '0x00'
        for (const member of extractedMessage.members) {
            const checkpoint_hash = computeCheckpointHashOfMember(prev_checkpoint_hash, group_uuid, member.commitment, member.identity_hash, member.proof, member.creator, member.merkle_root)
            expect(checkpoint_hash).toBe(member.checkpoint_hash)
            prev_checkpoint_hash = checkpoint_hash
        }
    })

    test("Check merkle proof generation", async () => {
        for (let i = 0; i < 10; i++) {
            identity_list.push(new Identity())

            // add element
            const message = {
                path: `/groups/${group_uuid}/members/add`,
                commitment: identity_list[i].commitment.toString(),
                identity_hash: identity_list[i].commitment.toString(), // in real world apps, use real identity hash like number if ID card, etc.
                proof: 'proof',
            }

            const nonce = (await request(api).get(`/nonces/${ADMIN_ADDRESS}`)).body.nonce;
            const payload = await signMessageWithNonce(message, ADMIN_PRIVATE_KEY, nonce)
            const add_res = await request(api)
                .post(`/groups/${group_uuid}/members/add`)
                .send(payload)

            if (add_res.status !== 200)
                console.error(`Error: Expected status 200, but got ${add_res.status}, error: ${add_res.text}`);

            // generate merkle proof
            const res = await request(api).get(`/groups/${group_uuid}/members/${identity_list[i].commitment}/merkle_proof`)
            const merkle_proof = res.body.merkle_proof

            const root = (await request(api).get(`/groups/${group_uuid}/root`)).body.root;
            expect(root).toBe(merkle_proof.root)
            expect(identity_list[i].commitment.toString()).toBe(merkle_proof.leaf)
        }
    })

    test("Cast votes", async () => {
        for (let i = 0; i < 10; i++) {
            const merkle_proof_res = await request(api).get(`/groups/${group_uuid}/members/${identity_list[i].commitment}/merkle_proof`)
            const merkle_proof = merkle_proof_res.body.merkle_proof
            const scope = uuidToHex(voting_uuid)
            const proof = await generateProof(identity_list[i], merkle_proof, Math.floor(Math.random() * 4) + 1, scope)

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
        }
    }, 15000)

    test("List votes and check checkpoint hashes", async () => {
        const res = await request(api).get(`/votings/${voting_uuid}/votes`)

        if (res.status !== 200)
            console.error(`Error: Expected status 200, but got ${res.status}, error: ${res.text}`);

        const [extractedMessage, address] = await verifyAndExtractMessage(res.body);
        let prev_checkpoint_hash = '0x00'
        for (const vote of extractedMessage.votes) {
            const checkpoint_hash = computeCheckpointHashOfVote(prev_checkpoint_hash, voting_uuid, group_uuid, vote.nullifier, vote.merkle_root, vote.proof, vote.vote)
            expect(checkpoint_hash).toBe(vote.checkpoint_hash)
            prev_checkpoint_hash = checkpoint_hash
        }
    })

})