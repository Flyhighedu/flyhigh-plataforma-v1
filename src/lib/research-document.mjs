// Keep the original research (including provenance) in storage and generation.
// Only the reading/editing surface omits the search bibliography and raw URLs.
export function researchDocument(raw = '') {
    if (typeof raw !== 'string') return { text: '', references: '' };
    const lines = raw.split(/\r?\n/);
    const content = [], references = [];
    let bibliography = false;
    for (const line of lines) {
        const heading = line.replace(/^[\s#>*-]+/, '').replace(/\*\*/g, '').trim();
        if (/^(?:fuentes(?: de la b[uú]squeda| consultadas| de informaci[oó]n)?|referencias(?: bibliogr[aá]ficas)?|bibliograf[ií]a)(?:\s*\([^)]*\))?\s*:?$/i.test(heading)) { bibliography = true; continue; }
        else if (bibliography && /^#{1,6}\s/.test(line)) bibliography = false;
        if (bibliography || /^\s*(?:[-*•]|\[\d+\]:)?\s*https?:\/\//.test(line)) references.push(line);
        else {
            const source = line.match(/(?:^|(?<=\.)\s+)(?:Fuente|Fuentes):\s*.+$/i);
            if (source) { references.push(source[0].trim()); content.push(line.slice(0, source.index)); }
            else content.push(line);
        }
    }
    const body = content.join('\n');
    const urls = body.match(/https?:\/\/[^\s<>\])]+/g) || [];
    const text = body.replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, '$1')
        .replace(/\(?https?:\/\/[^\s<>]+\)?/g, '')
        .replace(/\[\d+(?:,\s*\d+)*\]/g, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\n{3,}/g, '\n\n').trim();
    return { text, references: [...new Set([...references, ...urls.map(url => `- ${url}`)].map(line => line.trim()).filter(Boolean))].join('\n') };
}

export function replaceResearchDocument(raw, text) {
    const { references } = researchDocument(raw);
    return text + (references ? `\n\nFuentes de la búsqueda:\n${references}` : '');
}
