
export function uuidToHex(uuid: string): string {
    const hexString = uuid.replace(/-/g, '');
    return `0x${hexString}`;
}