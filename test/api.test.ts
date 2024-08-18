import { describe, expect, test, afterAll } from '@jest/globals';
import request from 'supertest';
import { api } from '../src/api'
import { pool } from "../src/utils/db_utils"
import { signMessageWithNonce, verifyAndExtractMessage } from "../src/utils/ethereum_utils"

const ADMIN_ADDRESS = "0x1C7bcE0821f78F952308F222E5d911312CA10400";
const ADMIN_PRIVATE_KEY = "0xb16ee57cb3c497cab8aebf284ac19bb594f7a253077c3b0c15fc8ba44b6325a5";

const SERVER_ADDRESS = "0xA3F12e07Bd15439E2A253b6DB0a4131a56058817";

describe("Testing the API", () => {

    afterAll(async () => {
        await pool.end();
    });

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
    });

    /*
    test("Add group admin", async () => {
        const message = {
            path: '/group_admins/add',
            foo: 123,
            bar: 456
        }

        const nonce = (await request(api).get('/nonces/0x1C7bcE0821f78F952308F222E5d911312CA10400')).body.nonce;
        const payload = await signMessageWithNonce(message, ADMIN_PRIVATE_KEY, nonce)
        const res = await request(api)
            .post('/group_admins/add')
            .send(payload)

        if (res.status !== 200)
            console.error(`Error: Expected status 200, but got ${res.status}, error: ${res.text}`);

        console.log(res.body)
        expect(res.status).toBe(200)
    })
    */

})