import express, { Express, Request, Response, NextFunction } from 'express';
import { Wallet } from "ethers";
import { signMessageWithNonce, verifyAndExtractMessage, getNonce } from "../src/utils/ethereum_utils"
import { addGroup } from "../src/services/groups_service"

import './utils/env_utils'

export const api: Express = express();

// catch all unhandled errors
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// verify signature middleware
async function verifySignatureMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
        const [extractedMessage, address] = await verifyAndExtractMessage(req.body);

        if (extractedMessage.path != req.path)
            throw new Error("Invalid path in the signed message!")

        req.body.extractedMessage = extractedMessage
        req.body.extractedAddress = address

        next()
    } catch (error) {
        next(error);
    }
}

// sign server response 
const server_wallet = new Wallet(process.env.SERVER_PRIVATE_KEY)
const server_address = server_wallet.address

async function signResponse(message: any) {
    const nonce = await getNonce(server_address)
    const payload = await signMessageWithNonce(message, process.env.SERVER_PRIVATE_KEY, nonce)
    return payload
}

api.use(express.json());

api.get('/', asyncHandler(async (req: Request, res: Response) => {
    res.send("zkDemocracy")
}))

api.get('/nonces/:address', asyncHandler(async (req: Request, res: Response) => {
    const address = req.params.address;
    const nonce = await getNonce(address);
    res.send({
        nonce
    })
}))

api.post('/groups/add', verifySignatureMiddleware, asyncHandler(async (req: Request, res: Response) => {
    if (req.body.extractedAddress != process.env.ADMIN_ADDRESS)
        throw new Error('Only admin is allowed to add groups!');

    const group_name = req.body.extractedMessage.group_name
    const creator = req.body.extractedAddress
    const uuid = await addGroup(group_name, creator)
    res.send(await signResponse({ 
        group_name,
        creator,
        uuid 
    }))
}))


api.post('/group_admins/add', verifySignatureMiddleware, asyncHandler(async (req: Request, res: Response) => {
    res.send(req.body.extractedMessage)
}))

api.use((err, req, res, next) => {
    res.status(500).send(err.message || 'Sorry! Something bad happened. :(');
});