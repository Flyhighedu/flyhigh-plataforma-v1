export async function readResearchStream(response, onProgress) {
    if (!response.headers.get('content-type')?.includes('application/x-ndjson')) {
        const data = await response.json();
        if (!response.ok || data.allFailed) throw new Error(data.error || data.article || 'No se pudo investigar este lugar.');
        return data;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '', result;
    const consume = line => {
        if (!line.trim()) return;
        const event = JSON.parse(line);
        if (event.type === 'progress') onProgress(event.message);
        if (event.type === 'error') throw new Error(event.message);
        if (event.type === 'result') result = event.data;
    };
    try {
        while (true) {
            const { value, done } = await reader.read();
            buffer += decoder.decode(value, { stream: !done });
            const lines = buffer.split('\n');
            buffer = lines.pop();
            lines.forEach(consume);
            if (done) break;
        }
        consume(buffer);
        if (!result) throw new Error('La investigación se interrumpió. Intenta de nuevo.');
        return result;
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
