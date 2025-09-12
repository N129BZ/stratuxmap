

export async function getDatabaseList() {
    const response = await fetch('/tiles/tilesets');
    const data = await response.json();
    return data;
}

export async function getMetadataset(dbname) {
    const response = await fetch(`/metadataset?db=${dbname}`);
    const data = await response.json();
    return data;
}
