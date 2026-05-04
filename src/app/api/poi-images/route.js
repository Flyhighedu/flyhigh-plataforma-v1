import { NextResponse } from 'next/server';

// ═══════════════════════════════════════════════════════════════
// POI Images — Tavily API (Imágenes Web)
// Reemplaza a Google Custom Search para consolidar costos/APIs.
// ═══════════════════════════════════════════════════════════════

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

export async function POST(request) {
    try {
        const { poiName, context } = await request.json();
        if (!poiName) return NextResponse.json({ images: [] });
        if (!TAVILY_API_KEY) {
            console.warn('⚠️ No TAVILY_API_KEY found');
            return NextResponse.json({ images: [] });
        }

        // Se exige 'exterior' 'fachada' y se evita 'interior' para asegurar que el edificio sea reconocible.
        const searchQuery = `${poiName} ${context || 'México'} exterior fachada arquitectura -interior -mural -adentro`;
        
        const tavilyBody = JSON.stringify({
            api_key: TAVILY_API_KEY,
            query: searchQuery,
            include_images: true,
            include_answer: false,
            search_depth: 'basic',
            max_results: 2 // Usamos 2 resultados para optimizar tiempo/costo
        });

        const [tavilyRes, wikiRes] = await Promise.allSettled([
            fetch('https://api.tavily.com/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: tavilyBody,
                cache: 'no-store'
            }),
            fetch(`https://es.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(poiName + ' ' + (context || 'México'))}&gsrlimit=3&prop=pageimages&pithumbsize=400&piprop=original|thumbnail&format=json&origin=*`)
        ]);

        let finalImages = [];

        // 1. Tavily Images
        if (tavilyRes.status === 'fulfilled' && tavilyRes.value.ok) {
            try {
                const data = await tavilyRes.value.json();
                const tImages = (data.images || []).map((url) => ({
                    url,
                    thumbUrl: url,
                    credit: 'Tavily',
                    source: 'tavily'
                }));
                finalImages = [...finalImages, ...tImages];
            } catch (e) {
                console.warn('Error parsing Tavily images:', e);
            }
        } else {
            console.warn(`Tavily Images API failed or returned non-ok.`);
        }

        // 2. Wikipedia Images
        if (wikiRes.status === 'fulfilled' && wikiRes.value.ok) {
            try {
                const wikiData = await wikiRes.value.json();
                if (wikiData?.query?.pages) {
                    const pages = Object.values(wikiData.query.pages);
                    const wImages = pages
                        .filter(p => p.thumbnail || p.original)
                        .map(p => {
                            const original = p.original?.source;
                            const thumb = p.thumbnail?.source;
                            return {
                                url: original || thumb,
                                thumbUrl: thumb || original,
                                credit: 'Wikipedia',
                                source: 'wikipedia'
                            };
                        })
                        .filter(img => img.url && img.thumbUrl); // Ensure valid
                    finalImages = [...finalImages, ...wImages];
                }
            } catch (e) {
                console.warn('Error parsing Wikipedia images:', e);
            }
        }

        // Eliminar duplicados simples por URL
        const uniqueImages = [];
        const seenUrls = new Set();
        for (const img of finalImages) {
            if (!seenUrls.has(img.url)) {
                seenUrls.add(img.url);
                uniqueImages.push(img);
            }
        }

        return NextResponse.json({ images: uniqueImages });

    } catch (error) {
        console.error('POI images fatal error:', error.message);
        return NextResponse.json({ images: [] }, { status: 500 });
    }
}
