**TODO**

- State (state) filed for groups and votings, and merkle_root field for groups. Members can be added to group only if the group is 'open'. If group is 'closed' then the final merkle root is written to the merkle_root field, and adding members is blocked. Same for votings.

- DB indexes for faster query

- check identity_hash and nullifier for uniquness