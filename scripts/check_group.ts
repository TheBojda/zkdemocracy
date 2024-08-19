import { rebuildGroupFromDB } from "../src/services/group_management_service"

const main = async () => {
    await rebuildGroupFromDB("44275f9f-76c6-4701-80af-eac941742066")
}

main().then(() => {
    console.log("Check complete.");
    process.exit(0);
}).catch((error) => {
    console.error("Error during check:", error);
    process.exit(1);
});
