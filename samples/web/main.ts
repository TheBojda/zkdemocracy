
const ADMIN_ADDRESS = "0x1C7bcE0821f78F952308F222E5d911312CA10400";
const BASE_URL = "http://localhost:1234/api"; // set in .proxyrc

async function main() {
    const response = await (await fetch(`${BASE_URL}/nonces/${ADMIN_ADDRESS}`)).json()
    console.log(response)
}

main()