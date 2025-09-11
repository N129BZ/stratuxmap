

export async function getDatabaseList() {
    const response = await fetch('/databaselist');
    const data = await response.json();
    return data;
}

export async function getMetadatsets() {
    const response = await fetch('/metadatasets');
    const data = await response.json();
    return data;
}
