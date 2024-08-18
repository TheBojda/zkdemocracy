import { runQuery } from '../utils/db_utils'

export async function assignVotingToGroup(voting_uuid: string, group_uuid: string, creator: string) {
    await runQuery("INSERT INTO `votings_groups` (votings_id, groups_id, creator) SELECT v.id, g.id, ? FROM `votings` v JOIN `groups` g ON g.uuid = ? WHERE v.uuid = ?", [creator, group_uuid, voting_uuid])
}