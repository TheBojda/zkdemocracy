import { runQuery } from '../utils/db_utils'
import { isAddress } from 'ethers'

export async function addGroupAdmin(uuid: string, admin: string, creator: string) {
    if (!isAddress(admin))
        throw new Error('Admin must be a velid Ethereum address!')

    await runQuery("INSERT INTO `group_admins` (groups_id, admin, creator) SELECT g.id, ?, ? FROM `groups` g WHERE g.uuid = ?", [admin, creator, uuid])
}