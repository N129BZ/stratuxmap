

export async function getDatabaseList() {
    const response = await fetch('/api/data');
    const data = await response.json();
    return data;
}

export async function getMetadatsets() {
    const response = await fetch('/api/data');
    const data = await response.json();
    return data;
}
