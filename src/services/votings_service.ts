import { runQuery } from '../utils/db_utils'
import { v4 as uuidv4 } from 'uuid';

export async function addVoting(name: string, creator: string) {
    const uuid = uuidv4();
    await runQuery("INSERT INTO `votings` (uuid, name, creator) VALUES (?, ?, ?)", [uuid, name, creator])
    return uuid
}