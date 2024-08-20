import { runQuery } from '../utils/db_utils'
import { uuidToHex } from '../utils/conversion_utils'
import { v4 as uuidv4 } from 'uuid';
import { SemaphoreProof, verifyProof } from "@semaphore-protocol/core"

export async function addVoting(name: string, creator: string) {
    const uuid = uuidv4();
    await runQuery("INSERT INTO `votings` (uuid, name, creator) VALUES (?, ?, ?)", [uuid, name, creator])
    return uuid
}

export async function assignVotingToGroup(voting_uuid: string, group_uuid: string, creator: string) {
    await runQuery("INSERT INTO `votings_groups` (votings_id, groups_id, creator) SELECT v.id, g.id, ? FROM `votings` v JOIN `groups` g ON g.uuid = ? WHERE v.uuid = ?", [creator, group_uuid, voting_uuid])
}

async function checkMerkleRoot(group_uuid: string, merkle_root: string) {
    const rows = await runQuery("SELECT EXISTS (SELECT 1 FROM members m JOIN `groups` g ON m.groups_id = g.id WHERE g.uuid = ? AND m.merkle_root = ?) AS merkle_root_exists", [group_uuid, merkle_root])
    return rows.length > 0 && rows[0].merkle_root_exists === 1;
}

export async function addVote(voting_uuid: string, group_uuid: string, proof: SemaphoreProof) {
    if (!await checkMerkleRoot(group_uuid, proof.merkleTreeRoot))
        throw new Error('Invalid merkle root!')

    const scope = uuidToHex(voting_uuid)
    if (BigInt(proof.scope) != BigInt(scope))
        throw new Error('Invalid voting uuid!')

    if (!await verifyProof(proof))
        throw new Error('Invalid proof!')

    await runQuery("INSERT INTO votes (votings_id, groups_id, nullifier, merkle_root, proof, vote) VALUES ((SELECT id FROM votings WHERE uuid = ?), (SELECT id FROM `groups` WHERE uuid = ?), ?, ?, ?, ?)", [voting_uuid, group_uuid, proof.nullifier, proof.merkleTreeRoot, JSON.stringify(proof), proof.message])
}