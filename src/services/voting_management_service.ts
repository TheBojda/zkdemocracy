import { runQuery } from '../utils/db_utils'
import { uuidToHex } from '../utils/conversion_utils'
import { v4 as uuidv4 } from 'uuid';
import { keccak256, toUtf8Bytes, concat } from 'ethers'
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

export function computeCheckpointHashOfVote(prev_hash: string, uuid: string, group_uuid: string, nullifier: string, merkle_root: string, proof: string, vote: string) {
    const fields = [uuid, group_uuid, nullifier, proof, vote, merkle_root]
    const hashes = fields.map((input) => {
        return keccak256(toUtf8Bytes(input));
    });
    hashes.unshift(prev_hash);
    return keccak256(concat(hashes))
}

export async function addVote(voting_uuid: string, group_uuid: string, proof: SemaphoreProof) {
    if (!await checkMerkleRoot(group_uuid, proof.merkleTreeRoot))
        throw new Error('Invalid merkle root!')

    const scope = uuidToHex(voting_uuid)
    if (BigInt(proof.scope) != BigInt(scope))
        throw new Error('Invalid voting uuid!')

    if (!await verifyProof(proof))
        throw new Error('Invalid proof!')

    const rows = await runQuery("SELECT checkpoint_hash FROM `votes` v JOIN `votings` vo ON v.votings_id = vo.id WHERE vo.uuid = ? ORDER BY v.id DESC LIMIT 1", [voting_uuid])
    const prev_checkpoint_hash = rows.length > 0 ? rows[0].checkpoint_hash : '0x00';
    const checkpoint_hash = computeCheckpointHashOfVote(prev_checkpoint_hash, voting_uuid, group_uuid, proof.nullifier, proof.merkleTreeRoot, JSON.stringify(proof), proof.message)

    await runQuery("INSERT INTO votes (votings_id, groups_id, nullifier, merkle_root, proof, vote, checkpoint_hash) VALUES ((SELECT id FROM votings WHERE uuid = ?), (SELECT id FROM `groups` WHERE uuid = ?), ?, ?, ?, ?, ?)", [voting_uuid, group_uuid, proof.nullifier, proof.merkleTreeRoot, JSON.stringify(proof), proof.message, checkpoint_hash])
}