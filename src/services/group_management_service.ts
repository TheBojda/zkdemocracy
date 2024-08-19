import { runQuery } from '../utils/db_utils'
import { v4 as uuidv4 } from 'uuid';
import { isAddress } from 'ethers'
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

export async function rebuildGroupFromDB(uuid: string) {
    const group = new Group();

    const rows = await runQuery("SELECT commitment, merkle_root FROM `members` m JOIN `groups` g ON m.groups_id = g.id WHERE g.uuid = ? ORDER BY m.id", [uuid]);
    for (const row of rows) {
        group.addMember(row.commitment)
        if (group.root != row.merkle_root)
            throw new Error('Member database is corrupt!')
        console.log({
            commitment: row.commitment,
            stored_root: row.merkle_root,
            calculated_root: group.root
        })
    }

    return group
}

const groupCache: Map<string, Group> = new Map<string, Group>();

export async function clearGroupCache(uuid: string) {
    groupCache.delete(uuid)
}

async function getGroupForUUID(uuid: string): Promise<Group> {
    if (!groupCache.has(uuid))
        groupCache.set(uuid, await rebuildGroupFromDB(uuid));

    return groupCache.get(uuid);
}

export async function addMemberToGroup(uuid: string, commitment: bigint, identityHash: string, proof: string, creator: string) {
    const group = await getGroupForUUID(uuid);
    group.addMember(commitment)

    const merkle_root = group.root.toString()

    await runQuery("INSERT INTO `members` (groups_id, commitment, identity_hash, merkle_root, proof, creator) SELECT g.id, ?, ?, ?, ?, ? FROM `groups` g WHERE g.uuid = ?", [commitment, identityHash, merkle_root, proof, creator, uuid])

    return merkle_root
}