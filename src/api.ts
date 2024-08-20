import express, { Express, Request, Response, NextFunction } from 'express';
import { Wallet } from "ethers";
import { signMessageWithNonce, verifyAndExtractMessage, getNonce } from "../src/utils/ethereum_utils"
import { HttpError } from "../src/utils/error_utils"
import { addGroup, addGroupAdmin, addMemberToGroup, listGroupMembers, getGroupForUUID, generateMerkleProof } from "../src/services/group_management_service"
import { addVoting, assignVotingToGroup } from "../src/services/voting_management_service"

import './utils/env_utils'

export const api: Express = express();

// catch all unhandled errors
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// verify signature middleware
async function verifySignatureMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
        const [extractedMessage, address] = await verifyAndExtractMessage(req.body);

        if (extractedMessage.path != req.path)
            throw new HttpError(400, "Invalid path in the signed message!")

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
        throw new HttpError(403, 'Only admin is allowed to add groups!');

    const group_name = req.body.extractedMessage.group_name
    const creator = req.body.extractedAddress
    const uuid = await addGroup(group_name, creator)
    res.send(await signResponse({
        group_name,
        uuid,
        creator,
        timestamp: new Date().toISOString()
    }))
}))


api.post('/groups/:group_uuid/admins/add', verifySignatureMiddleware, asyncHandler(async (req: Request, res: Response) => {
    if (req.body.extractedAddress != process.env.ADMIN_ADDRESS)
        throw new HttpError(403, 'Only admin is allowed to add group admins!');

    const group_uuid = req.params.group_uuid
    const group_admin = req.body.extractedMessage.group_admin
    const creator = req.body.extractedAddress
    addGroupAdmin(group_uuid, group_admin, creator)
    res.send(await signResponse({
        group_uuid,
        group_admin,
        creator,
        timestamp: new Date().toISOString()
    }))
}))

api.post('/votings/add', verifySignatureMiddleware, asyncHandler(async (req: Request, res: Response) => {
    if (req.body.extractedAddress != process.env.ADMIN_ADDRESS)
        throw new HttpError(403, 'Only admin is allowed to add votings!');

    const voting_name = req.body.extractedMessage.voting_name
    const creator = req.body.extractedAddress
    const uuid = await addVoting(voting_name, creator)
    res.send(await signResponse({
        voting_name,
        uuid,
        creator,
        timestamp: new Date().toISOString()
    }))
}))

api.post('/votings/:voting_uuid/groups/add', verifySignatureMiddleware, asyncHandler(async (req: Request, res: Response) => {
    if (req.body.extractedAddress != process.env.ADMIN_ADDRESS)
        throw new HttpError(403, 'Only admin is allowed to assign groups to votings!');

    const group_uuid = req.body.extractedMessage.group_uuid
    const voting_uuid = req.params.voting_uuid
    const creator = req.body.extractedAddress
    assignVotingToGroup(voting_uuid, group_uuid, creator)
    res.send(await signResponse({
        group_uuid,
        voting_uuid,
        creator,
        timestamp: new Date().toISOString()
    }))
}))

api.post('/groups/:group_uuid/members/add', verifySignatureMiddleware, asyncHandler(async (req: Request, res: Response) => {
    if (req.body.extractedAddress != process.env.ADMIN_ADDRESS)
        throw new HttpError(403, 'Only admin is allowed to assign groups to votings!');

    const group_uuid = req.params.group_uuid;
    const commitment = req.body.extractedMessage.commitment;
    const identity_hash = req.body.extractedMessage.identity_hash;
    const proof = req.body.extractedMessage.proof;
    const creator = req.body.extractedAddress;
    const merkle_root = await addMemberToGroup(group_uuid, commitment, identity_hash, proof, creator)
    res.send(await signResponse({
        group_uuid,
        commitment,
        identity_hash,
        proof,
        merkle_root,
        creator,
        timestamp: new Date().toISOString()
    }))
}))

api.get('/groups/:group_uuid/members', asyncHandler(async (req: Request, res: Response) => {
    const group_uuid = req.params.group_uuid;
    const members = await listGroupMembers(group_uuid);
    res.send(await signResponse(members))
}))

api.get('/groups/:group_uuid/root', asyncHandler(async (req: Request, res: Response) => {
    const group_uuid = req.params.group_uuid;
    const group = await getGroupForUUID(group_uuid);
    res.send({ "root": group.root.toString() })
}))

api.get('/groups/:group_uuid/members/:commitment/merkle_proof', asyncHandler(async (req: Request, res: Response) => {
    const group_uuid = req.params.group_uuid
    const commitment = req.params.commitment
    const merkle_proof = await generateMerkleProof(group_uuid, commitment)
    res.send({ merkle_proof })
}))

api.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof HttpError) {
        res.status(err.statusCode).send(err.message);
    } else {
        res.status(500).send(err.message || 'Sorry! Something bad happened. :(');
    }
});