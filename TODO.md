**TODO**

- Checkpoint hash (checkpoint_hash) field for votes and members tables. Checkpoint hash is a hash of the checkpoint_hash of the previous row, and all the important elements of the row, so it is a full hash of the DB to the given row. If you write the checkpoint_hash to a block chain, then the rows before the point are immutable. If anything is changed before the checkpoint_hash, then the hash itself is changing.

- State (state) filed for groups and votings, and merkle_root field for groups. Members can be added to group only if the group is 'open'. If group is 'closed' then the final merkle root is written to the merkle_root field, and adding members is blocked. Same for votings.

- DB indexes for faster query

- check identity_hash and nullifier for uniquness