import { runQuery } from '../utils/db_utils'
import { v4 as uuidv4 } from 'uuid';
import { isAddress, keccak256, toUtf8Bytes, concat} from 'ethers'
import { Group } from "@semaphore-protocol/core"

export async function addGroup(name: string, creator: string) {
    const uuid = uuidv4();
    await runQuery("INSERT INTO `groups` (uuid, name, creator) VALUES (?, ?, ?)", [uuid, name, creator])
    return uuid
}

export async function addGroupAdmin(uuid: string, admin: string, creator: string) {
    if (!isAddress(admin))
        throw new Error('Admin must be a velid Ethereum address!')

    await runQuery("INSERT INTO `group_admins` (groups_id, admin, creator) SELECT g.id, ?, ? FROM `groups` g WHERE g.uuid = ?", [admin, creator, uuid])
}

export function rebuildGroup(rows: { commitment: string; merkle_root: bigint }[]) {
    const group = new Group();

    for (const row of rows) {
        group.addMember(row.commitment)
        if (group.root != row.merkle_root)
            throw new Error('Member database is corrupt!')
    }

    return group
}

export async function rebuildGroupFromDB(uuid: string) {
    const rows = await runQuery("SELECT commitment, merkle_root FROM `members` m JOIN `groups` g ON m.groups_id = g.id WHERE g.uuid = ? ORDER BY m.id", [uuid]);
    return rebuildGroup(rows)
}

const groupCache: Map<string, Group> = new Map<string, Group>();

export async function clearGroupCache(uuid: string) {
    groupCache.delete(uuid)
}

export async function getGroupForUUID(uuid: string): Promise<Group> {
    if (!groupCache.has(uuid))
        groupCache.set(uuid, await rebuildGroupFromDB(uuid));

    return groupCache.get(uuid);
}

export function computeCheckpointHashOfMember(prev_hash: string, uuid: string, commitment: string, identityHash: string, proof: string, creator: string, merkle_root: string) {
    const fields = [uuid, commitment, identityHash, proof, creator, merkle_root]
    const hashes = fields.map((input) => {
        return keccak256(toUtf8Bytes(input));
    });
    hashes.unshift(prev_hash);
    return keccak256(concat(hashes))
}

export async function addMemberToGroup(uuid: string, commitment: bigint, identityHash: string, proof: string, creator: string) {
    const group = await getGroupForUUID(uuid);
    group.addMember(commitment)
    const merkle_root = group.root.toString()

    const rows = await runQuery("SELECT checkpoint_hash FROM `members` m JOIN `groups` g ON m.groups_id = g.id WHERE g.uuid = ? ORDER BY m.id DESC LIMIT 1", [uuid])
    const prev_checkpoint_hash = rows.length > 0 ? rows[0].checkpoint_hash : '0x00';
    const checkpoint_hash = computeCheckpointHashOfMember(prev_checkpoint_hash, uuid, commitment.toString(), identityHash, proof, creator, merkle_root)

    await runQuery("INSERT INTO `members` (groups_id, commitment, identity_hash, merkle_root, proof, creator, checkpoint_hash) SELECT g.id, ?, ?, ?, ?, ?, ? FROM `groups` g WHERE g.uuid = ?", [commitment, identityHash, merkle_root, proof, creator, checkpoint_hash, uuid])

    return merkle_root
}

export async function listGroupMembers(uuid: string) {
    const rows = await runQuery("SELECT m.id, commitment, identity_hash, merkle_root, proof, m.creator, m.created, checkpoint_hash FROM `members` m JOIN `groups` g ON m.groups_id = g.id WHERE g.uuid = ? ORDER BY m.id", [uuid]);
    return rows
}

function bigintToString(obj: any): any {
    if (typeof obj === 'bigint') {
        return obj.toString();
    } else if (Array.isArray(obj)) {
        return obj.map(bigintToString);
    } else if (typeof obj === 'object' && obj !== null) {
        return Object.fromEntries(
            Object.entries(obj).map(([key, value]) => [key, bigintToString(value)])
        );
    } else {
        return obj;
    }
}

export async function generateMerkleProof(uuid: string, commitment: string) {
    const group = await getGroupForUUID(uuid);
    return bigintToString(group.generateMerkleProof(group.indexOf(commitment)))
}
