

export const downloadFile = async (url: string): Promise<Buffer> => {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
            'content-type': 'application/octet-stream'
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to download file from ${url}: ${response.status} ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
}