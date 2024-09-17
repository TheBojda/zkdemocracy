# zkdemocracy
A ready-to-use anonymous voting system based on Semaphore zero-knowledge group management library

> Representative democracy is facing challenges, and new, more direct solutions are needed. zkDemocracy is a proof of concept that shows we can organize anonymous digital voting affordably, allowing people to participate in decision-making.

My article on HackerNoon about the project: [https://hackernoon.com/zkdemocracy-the-easiest-solution-for-zero-knowledge-proof-based-anonymous-voting](https://hackernoon.com/zkdemocracy-the-easiest-solution-for-zero-knowledge-proof-based-anonymous-voting)

The system can be used in standalone mode when a web or mobile client connects directly to the zkDemocracy backend. With this architecture, we can organize simpler voting processes.

In more complex cases, where there are multiple locations, many users, and a separate subsystem responsible for user identification, or use blockchain checkpoints to ensure the voting process, etc. zkDemocracy can integrate into the system as a service.

## Basics

The two fundamental elements of zkDemocracy are **groups** and **votings**.

The "groups" represent a group of voters. This could be, for example, the voters of an electoral district, the shareholders of a company, members of a smaller community, members of a DAO, or any other group.

The "votings" represent a voting event. This could be a presidential election, a referendum, a corporate decision-making process, or any other type of voting.

Multiple groups can participate in a voting event. For example, in a presidential election, the members of all electoral districts can vote, and the results of the vote are aggregated.

Similarly, a group can participate in multiple voting events. For example, the shareholders of a company can hold several votes.

Groups and votings have an n-to-m relationship with each other.

## Security

zkDemocracy is built on the [Semaphore library](https://semaphore.pse.dev/) developed by PSE. The zero-knowledge proof technology used by the library mathematically guarantees the anonymity of the voter.

Since zkDemocracy is a blockchain-free solution that can be easily deployed, we developed a custom mechanism that provides blockchain-level security over a MySQL database.

Similar to Ethereum transactions, in the case of zkDemocracy, every API call that modifies the database must be digitally signed. For digital signatures, we use standard Ethereum ECDSA signatures, allowing the standard tools used in Ethereum (e.g., software and hardware wallets) to be utilized.

Similar to a blockchain, the data in the zkDemocracy "groups" and "votings" tables is publicly accessible. Anyone can query this information through the API, and the server digitally signs the response, making the reply can be used as proof. If anyone later makes unauthorized modifications to the database (e.g., deleting a voter or a vote), this can be proven using the digitally signed copy of the previous version of the database.

Whenever a row is inserted into the database, the system calculates a checkpoint hash. The checkpoint hash is a keccak256 hash generated from the contents of the database fields and the checkpoint hash of the previous row. Since the hashes are chained together, similar to blockchain block hashes, the checkpoint hash of the last row is unique for the entire content of the database. If anything changes in the database, the checkpoint hash of every row after the modified one will change. The checkpoint hash is always included in the digitally signed API response, which can be used to prove any modification of the database.

If enhanced security is needed, external audit systems can periodically (e.g., every 10 minutes) query and store the digitally signed checkpoint hash. This makes it impossible to modify the database after the storage of the hash. The checkpoint hash can even be written to a blockchain, ensuring its secure storage.

At the end of the voting process, the list of votes can be queried in detail, and the zero-knowledge proof associated with each vote can be verified, ensuring that each vote comes from a member of the linked group. Additionally, everyone can verify their own vote. If any changes are detected (e.g., a vote was deleted or altered), the voter can prove fraud using the digitally signed proof received from the system.

## System setup

### For development and testing

- Install yarn and docker

- Install dependencies by `yarn`

- Start the development MySQL server by `yarn mysql:start` (It will start a MySQL 8.4 server in a docker container.)

- Create the database tables by `DEV_MODE=true yarn init:database`

- Run the tests by `DEV_MODE=true yarn test`

- Run the server in dev mode by `DEV_MODE=true yarn start`

- Stop the development MySQL server by `yarn mysql:stop`

### For production

- Install yarn

- Install dependencies by `yarn`

- Setup the server in the .env file

- Create the database tables by `yarn init:database`

- Build the server by `yarn build`

- Run the server by `node dist/src/main.js` or use pm2 or other node process managers 

**Don't run the server in multiple instances because of the local group cache.** If running multiple instances is needed, every group has to be uniquely assigned to one of the instances.

### .env settings

**MYSQL_HOST**

Host name of the MySQL server

**MYSQL_DATABASE**

MySQL database name

**MYSQL_USER**

MySQL user

**MYSQL_PASSWORD**

MySQL password

**ADMIN_ADDRESS**

Ethereum public address of the server admin.

The authentication of users in zkDemocracy is done by digital signatures. Every modification (typically POST) requests are signed. 

You can generate an Ethereum keypair by `yarn generate:ethereum_account`.

**SERVER_PRIVATE_KEY**

The private key of the server.

Most of the responses are digitally signed by the server because every signed response is also proof that the server has done something. If somebody breaks the server and changes the database, you can use this signed response to prove the attack.

## API quickstart

### Signed requests

Every modification (typically POST) requests are signed by an Ethereum private key. As Ethereum itself, zk Democracy uses nonces to make the transactions unique. 

You can request the current nonce by (or simply increment the counter by yourself):

```
GET /nonces/{Ethereum public key}
```

With the nonce, the request (transaction/message) can be signed by `signMessageWithNonce`.

The source code of the function from `src/utils/ethereum_utils.ts`:

```typescript
    const wallet = new Wallet(privateKey);
    const base64message = encodeBase64(toUtf8Bytes(JSON.stringify(message)))
    const base64nonce = encodeBase64(toUtf8Bytes(nonce.toString()))
    const content = base64nonce + '.' + base64message;
    const signature = wallet.signMessageSync(content);
    return {
        content: content,
        signature: signature,
        address: wallet.address
    }
```

As you can see, the signature method is relatively simple. The base64 encoded nonce and the base64 encoded message is concatenated by a '.' (dot) and signed with the Ethereum account. The `signMessageSync` function is compatible with Ethereum's `personal_sign`, so it can be easily generated on the client side by MetaMask, or in other programming languages (PHP/Go/Java/etc.) if you use zkDemocracy as a microservice, as a part of a bigger system.

### Signed responses

Most of the responses are signed by the server because these responses are also proofs of the server done the transaction. The users can use these proofs to prove attacks. For example, if you are registered as a voter, you will get a digitally signed proof of it in the request. If later an attacker removes you from the database, you can prove the attack by your proof. This system provides near-blockchain security on a blockchain-free system.

The response (proof) can be verified and decoded by `verifyAndExtractMessage`.

The source code of the function from `src/utils/ethereum_utils.ts`:

```typescript
export async function verifyAndExtractMessage(payload: { content: string, signature: string, address: string }) {

    ...

    const extractedAddress = verifyMessage(payload.content, payload.signature);
    if (payload.address != extractedAddress)
        throw new Error("Signature error!")

    ...

    const message = JSON.parse(toUtf8String(decodeBase64(base64message)));
    return [message, payload.address];
}
```

The format of the signed payload is very simple. A base64 encoded content, the signature, and the public address of the signer.

### A simplified version of the voting process

#### Create voting by `POST /votings/add`

```
POST /votings/add

signedRequest({
    path: "/votings/add",
    voting_name: "Test voting"
})
```

#### Create a group by `POST /groups/add`

```
POST /groups/add

signedRequest({
    path: "/groups/add",
    group_name: "Test group"
})
```

#### Assign a group to the voting (voting - group assignments are n - m, so several groups can be assigned to voting, and one group can be assigned to more than one voting)

```
POST /votings/{voting UUID}/groups/add

signedRequest({
    path: "/votings/{voting UUID}/groups/add",
    group_uuid: "{group UUID}"
})
```

#### Add members to the group by `POST /groups/{group UUID}/members/add`

```
POST /groups/{group UUID}/members/add

signedRequest({
    path: "/groups/{group UUID}/members/add",
    commitment: "...",
    identity_hash: "...",
    proof: "..."
})
```

`commitment`: A generated commitment for the zero-knowledge proof. Use [Semaphore's Identity](https://github.com/semaphore-protocol/semaphore/tree/main/packages/core) to generate the commitment.

`identity_hash`: A unique identity hash of the voter. One identity hash has only one commitment in the group. For example the hash of the unique ID number, the hash of a biometric ID, etc.

`proof`: A proof of verification, that can be freely defined by the system. For example, if every voter is identified by 2 randomly chosen persons, then the proof can be 2 digital signatures on the identity_hash. If the identification is done remotely, the proof can contain a reference and a hash of a video of the identification process, etc.

#### Voting

The user needs Merkle proof to generate the zero-knowledge proof. This can be generated by `GET /groups/{group UUID}/members/{commitment}/merkle_proof`

The zero-knowledge proof can be generated by Semaphore's `generateProof`.

```
const proof = await generateProof(identity, merkle_proof, vote, uuidToHex(voting_uuid))
```

`identity`: A Semaphore generated [Identity](https://github.com/semaphore-protocol/semaphore/tree/main/packages/core), whose commitment has been added to the group.

`merkle_proof`: The Merkle-proof is given by the API.

`vote`: The vote itself. Simply the number of the chosen option.

`voting_uuid`: The uuid of the voting. The source code of `uuidToHex` is accessible in `src/utils/conversion_utils.ts`

If the zero-knowledge proof is ready, send it to the server by `POST /votings/{voting UUID}/vote`

```
POST /votings/{voting UUID}/vote

{
    group_uuid: {group UUID},
    proof: {proof}
}
```

This request is not signed. It contains the group where the voter is registered, and the previously generated proof.

---

For more info, please check the source code and the tests in `test/api.test.ts`.

A detailed article about zkDemocracy is coming soon...

