'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import ClosureTaskScreen from './ClosureTaskScreen';
import { CLOSURE_STEPS } from '@/constants/closureFlow';
import { PILOT_PREP_BLOCKS } from '@/config/operationalChecklists';

const PREP_BLOCK_IDS = new Set(PILOT_PREP_BLOCKS.map((block) => block.id));
const PREP_ITEM_IDS = new Set(
    PILOT_PREP_BLOCKS.flatMap((block) => block.items.map((item) => item.id))
);

const ITEM_ARTICLE_BY_ID = Object.freeze({
    drone: { singular: 'el', plural: 'los' },
    controllers: { singular: 'el', plural: 'los' },
    propellers: { singular: 'la', plural: 'las' },
    drone_batteries: { singular: 'la', plural: 'las' },
    power_station: { singular: 'el', plural: 'los' },
    chargers: { singular: 'el', plural: 'los' },
    goggles: { singular: 'la', plural: 'las' },
    headphones: { singular: 'el', plural: 'los' },
    cabinet: { singular: 'el', plural: 'los' },
    speaker: { singular: 'la', plural: 'las' },
    media_player: { singular: 'el', plural: 'los' },
    microphone: { singular: 'el', plural: 'los' },
    adapters: { singular: 'el', plural: 'los' }
});

function resolveInventoryArticle(itemId, quantity) {
    const normalizedQuantity = Number(quantity);
    const isSingular = Number.isFinite(normalizedQuantity) && normalizedQuantity === 1;
    const grammar = ITEM_ARTICLE_BY_ID[itemId] || { singular: 'el', plural: 'los' };
    return isSingular ? grammar.singular : grammar.plural;
}

function buildInventoryLabel(item, quantity) {
    const article = resolveInventoryArticle(item.id, quantity);
    return `¿Confirmas que regresaron ${article} ${quantity} ${item.label}?`;
}

function buildInventoryBlocks(quantityByItem = null) {
    return PILOT_PREP_BLOCKS.map((block) => {
        const items = block.items.map((item) => {
            const quantity = Number(quantityByItem?.[item.id]);
            const safeQuantity = Number.isFinite(quantity) && quantity >= 0 ? quantity : item.defaultQty;

            return {
                id: `return_inventory_${block.id}_${item.id}`,
                label: buildInventoryLabel(item, safeQuantity)
            };
        });

        return {
            id: block.id,
            title: block.label,
            color: block.color,
            bgColor: block.bgColor,
            items
        };
    });
}

function ReturnInventoryHero() {
    return (
        <div className="mx-auto mb-2 w-full max-w-[330px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_14px_36px_-20px_rgba(15,23,42,0.35)]">
            <svg viewBox="0 0 760 300" xmlns="http://www.w3.org/2000/svg" className="h-auto w-full">
                <defs>
                    <linearGradient id="inv-bg" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#EFF6FF" />
                        <stop offset="100%" stopColor="#F8FAFC" />
                    </linearGradient>
                </defs>
                <rect width="760" height="300" fill="url(#inv-bg)" />
                <rect x="70" y="58" width="160" height="188" rx="14" fill="#DBEAFE" stroke="#93C5FD" strokeWidth="4" />
                <rect x="300" y="42" width="160" height="204" rx="14" fill="#BFDBFE" stroke="#60A5FA" strokeWidth="4" />
                <rect x="530" y="72" width="160" height="174" rx="14" fill="#93C5FD" stroke="#3B82F6" strokeWidth="4" />
                <path d="M90 96L210 96 M320 90L440 90 M550 112L670 112" stroke="#1D4ED8" strokeWidth="6" strokeLinecap="round" strokeOpacity="0.25" />
                <circle cx="380" cy="150" r="56" fill="#0EA5E9" opacity="0.15" />
                <path d="M354 151L372 169L406 135" fill="none" stroke="#0284C7" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </div>
    );
}

export default function ReturnInventoryScreen({ journeyId, ...props }) {
    const [checklistBlocks, setChecklistBlocks] = useState(() => buildInventoryBlocks());

    const checklistItems = useMemo(
        () => checklistBlocks.flatMap((block) => block.items),
        [checklistBlocks]
    );

    useEffect(() => {
        if (!journeyId) return;

        let cancelled = false;

        const loadQuantities = async () => {
            try {
                const supabase = createClient();
                const { data, error } = await supabase
                    .from('staff_prep_events')
                    .select('event_type, payload, created_at')
                    .eq('journey_id', journeyId)
                    .in('event_type', ['check_qty', 'prep_complete'])
                    .order('created_at', { ascending: false })
                    .limit(800);

                if (error) throw error;

                let latestPilotPrepAtMs = null;
                for (const row of data || []) {
                    if (row?.event_type !== 'prep_complete') continue;

                    const role = String(row?.payload?.role || '').trim().toLowerCase();
                    if (role !== 'pilot') continue;

                    const prepTimestamp = Date.parse(row?.payload?.timestamp || row?.created_at || '');
                    if (Number.isFinite(prepTimestamp)) {
                        latestPilotPrepAtMs = prepTimestamp;
                        break;
                    }
                }

                const quantityByItem = Object.create(null);
                for (const row of data || []) {
                    if (row?.event_type !== 'check_qty') continue;

                    const itemId = String(row?.payload?.item_id || '').trim();
                    if (!itemId || !PREP_ITEM_IDS.has(itemId)) continue;

                    const categoryId = String(row?.payload?.category || '').trim();
                    if (categoryId && !PREP_BLOCK_IDS.has(categoryId)) continue;

                    const rowTimestamp = Date.parse(row?.created_at || row?.payload?.timestamp || '');
                    if (
                        Number.isFinite(latestPilotPrepAtMs) &&
                        Number.isFinite(rowTimestamp) &&
                        rowTimestamp > latestPilotPrepAtMs
                    ) {
                        continue;
                    }

                    if (!itemId || quantityByItem[itemId] != null) continue;
                    const quantity = Number(row?.payload?.quantity);
                    if (!Number.isFinite(quantity)) continue;
                    quantityByItem[itemId] = quantity;
                }

                if (!cancelled) {
                    setChecklistBlocks(buildInventoryBlocks(quantityByItem));
                }
            } catch (error) {
                console.warn('No se pudieron cargar cantidades de inventario inicial:', error);
            }
        };

        loadQuantities();
        return () => {
            cancelled = true;
        };
    }, [journeyId]);

    const subtitle = useMemo(
        () => 'Verifiquemos que todo el equipo llegó a salvo a la base.',
        []
    );

    return (
        <ClosureTaskScreen
            {...props}
            journeyId={journeyId}
            screenKey={CLOSURE_STEPS.RETURN_INVENTORY}
            title="Inventario de Retorno"
            description={subtitle}
            iconName="inventory_2"
            headerLayout="canvas"
            layoutDensity="compact"
            heroContent={<ReturnInventoryHero />}
            checklistMetaKey="pilot_return_inventory_checks"
            doneFlagKey="pilot_return_inventory_done"
            doneAtKey="pilot_return_inventory_done_at"
            doneByKey="pilot_return_inventory_done_by"
            doneByNameKey="pilot_return_inventory_done_by_name"
            checklistGroups={checklistBlocks}
            checklistItems={checklistItems}
            prerequisites={[
                {
                    key: 'global_equipment_unloaded',
                    keys: ['global_equipment_unloaded', 'closure_equipment_unload_done'],
                    label: 'Equipo descargado en base'
                }
            ]}
            nextClosureStep={CLOSURE_STEPS.ELECTRONICS_CHARGING}
            allowedRoles={['pilot']}
            waitMessage="Esperando al piloto para cerrar inventario de retorno."
            buttonLabel="Inventario de retorno confirmado"
            doneLabel="Inventario confirmado"
            successMessage="Inventario de retorno confirmado."
        />
    );
}
