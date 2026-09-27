'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ArrowLeft, Plane, Plus, Loader2 } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { createClient } from '@/utils/supabase/client';
import NarrationCatalog from '@/components/shared/NarrationCatalog';
import CreateNarrationDialog from '@/components/shared/CreateNarrationDialog';
import POIDetailModal from './POIDetailModal';
import styles from '@/components/shared/NarrationLibrary.module.css';
const SimulationContainer = dynamic(() => import('./SimulationContainer'), { ssr: false, loading: () => <p role="status">Cargando simulador…</p> });
const TacticalMapScreen = dynamic(() => import('./TacticalMapScreen'), { ssr: false, loading: () => <p role="status">Cargando mapa…</p> });
export default function NarrationsHub() {
    const router = useRouter();
    const [userId, setUserId] = useState(null);
    const [profile, setProfile] = useState(null);
    const [pois, setPois] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [tab, setTab] = useState('library');
    const [mapVisited, setMapVisited] = useState(false);
    const [creating, setCreating] = useState(false);
    const [simulatorActive, setSimulatorActive] = useState(false);
    const [selectedPoi, setSelectedPoi] = useState(null);
    const [isPoiModalOpen, setIsPoiModalOpen] = useState(false);
    const [highlightedId, setHighlightedId] = useState(null);
    const [reload, setReload] = useState(0);
    const reduced = useReducedMotion();
    const tabRefs = useRef([]);
    useEffect(() => {
        let active = true;
        (async () => {
            setError('');
            try {
                const db = createClient();
                const { data: { user } } = await db.auth.getUser();
                if (!user) { router.replace('/staff/login'); return; }
                const [personal, official, account] = await Promise.all([
                    db.from('pilot_pois').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
                    fetch('/api/official-pois').then(async response => { if (!response.ok) throw new Error('No se pudieron cargar las narraciones oficiales.'); return response.json(); }),
                    db.from('staff_profiles').select('full_name, role').eq('user_id', user.id).single()
                ]);
                if (personal.error) throw personal.error;
                if (active) { setUserId(user.id); setProfile(account.data); setPois([...(official.pois || []), ...(personal.data || [])]); }
            } catch (failure) { if (active) setError(failure.message || 'No se pudo cargar la biblioteca.'); }
            finally { if (active) setLoading(false); }
        })();
        return () => { active = false; };
    }, [router, reload]);
    const switchTab = value => { setTab(value); if (value === 'explore') setMapVisited(true); };
    const onMapChange = useCallback(() => setReload(value => value + 1), []);
    return <div className={styles.shell}>
        <div hidden={simulatorActive}>
            <header className={styles.header}><div className={styles.headerRow}><Link href="/staff/dashboard" aria-label="Volver al inicio"><ArrowLeft size={21}/></Link><h1>Narraciones</h1><button onClick={() => setSimulatorActive(true)}><Plane size={19}/>Simulador</button></div>
                <div className={styles.tabs} role="tablist" aria-label="Narraciones">{[['library','Biblioteca'],['explore','Explorar']].map(([value,label], index) => <button key={value} ref={element => { tabRefs.current[index] = element; }} role="tab" id={'narrations-tab-' + value} aria-controls={'narrations-panel-' + value} aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} onClick={() => switchTab(value)} onKeyDown={event => { if (['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1-index; switchTab(next ? 'explore' : 'library'); tabRefs.current[next]?.focus(); } }}>{tab === value && <motion.i className={styles.activeTab} layoutId="narrations-active-tab" transition={{ duration: reduced ? 0 : .24 }}/>}<span>{label}</span></button>)}</div>
            </header>
            <motion.main animate={{ opacity: tab === 'library' ? 1 : 0 }} transition={{ duration: reduced ? 0 : .2 }} id="narrations-panel-library" role="tabpanel" aria-labelledby="narrations-tab-library" hidden={tab !== 'library'} className={styles.content}>
                <div className={styles.topline}><h2>Tu biblioteca</h2><button className={styles.primary} onClick={() => setCreating(true)}><Plus size={18}/>Crear narración</button></div>
                {loading && <p role="status"><Loader2 size={20} className={styles.spin}/>Cargando narraciones…</p>}
                {error && <div className={styles.error} role="alert">{error} <button className={styles.secondary} onClick={() => setReload(value => value + 1)}>Reintentar</button></div>}
                {!loading && !error && <NarrationCatalog pois={pois} highlightedId={highlightedId} active={tab === 'library' && !simulatorActive && !isPoiModalOpen} onOpen={poi => { setSelectedPoi(poi); setIsPoiModalOpen(true); }}/>}
            </motion.main>
            <div id="narrations-panel-explore" role="tabpanel" aria-labelledby="narrations-tab-explore" hidden={tab !== 'explore'}>
                {mapVisited && userId && <div className={styles.mapPanel}><TacticalMapScreen userId={userId} profile={profile} embedded onContentChange={onMapChange}/></div>}
                {!userId && <div className={styles.content}>{error ? <div role="alert">{error}<button className={styles.secondary} onClick={() => setReload(value => value+1)}>Reintentar</button></div> : <p role="status">Cargando mapa…</p>}</div>}
            </div>
        </div>
        {simulatorActive && <SimulationContainer onExit={() => setSimulatorActive(false)}/>}
        {creating && <CreateNarrationDialog onClose={() => setCreating(false)} onPlace={() => { setCreating(false); switchTab('explore'); }} onTopic={() => { setCreating(false); setSelectedPoi({ is_general_topic: true, name: '', description: '' }); setIsPoiModalOpen(true); }}/>}
            <POIDetailModal
                closeLabel="Volver a biblioteca"
                isOpen={isPoiModalOpen}
                onClose={() => setIsPoiModalOpen(false)}
                poi={selectedPoi}
                isNewPin={!selectedPoi?.id}
                readOnly={!!selectedPoi?.is_official}
                onSave={async (poiData) => {
                    if (poiData.is_official) { setIsPoiModalOpen(false); return; }
                    try {
                        const supabase = createClient();
                        const updatePayload = {
                            name: poiData.name,
                            description: poiData.description,
                            image_url: poiData.image_url,
                            narrative_script: poiData.narrative_script || null,
                            audio_url: poiData.audio_url || null,
                            audio_duration_seconds: poiData.audio_duration_seconds || null,
                            audio_generated_at: poiData.audio_generated_at || null,
                            research_article: poiData.research_article || null,
                            narrative_versions: poiData.narrative_versions || {},
                        };

                        if (!poiData.id) {
                            // Insert
                            const { data: newPoi, error } = await supabase
                                .from('pilot_pois')
                                .insert([{ ...updatePayload, user_id: userId, is_general_topic: true }])
                                .select()
                                .single();
                            if (error) throw error;
                            setPois(prev => [newPoi, ...prev]); setHighlightedId(newPoi.id);
                        } else {
                            // Update
                            const { error } = await supabase
                                .from('pilot_pois')
                                .update(updatePayload)
                                .eq('id', poiData.id);
                            if (error) throw error;
                            setPois(prev => prev.map(p => p.id === poiData.id ? { ...p, ...updatePayload } : p)); setHighlightedId(poiData.id);
                        }

                    } catch (error) {
                        console.error('Error saving POI:', error);
                        throw new Error('No se guardaron los cambios. ' + (error.message || 'Intenta de nuevo.'));
                    }
                }}
                onDelete={selectedPoi?.is_official ? undefined : async (poiId) => {
                    try {
                        const supabase = createClient();
                        const { error } = await supabase.from('pilot_pois').delete().eq('id', poiId);
                        if (error) throw error;
                        setPois(prev => prev.filter(p => p.id !== poiId));
                        setIsPoiModalOpen(false);
                    } catch (error) {
                        console.error('Error deleting POI:', error);
                        throw new Error('No se pudo eliminar el punto. Intenta de nuevo.');
                    }
                }}
            />

    </div>;
}
