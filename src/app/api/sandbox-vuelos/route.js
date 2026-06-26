import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Server-side Supabase client with Service Role Key — bypasses RLS
function getAdminSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

// GET — fetch journeys (master) with nested vuelos count, or vuelos for a specific journey
// Also supports ?schools=1 to return the school catalog for ghost row
export async function GET(request) {
    try {
        const supabase = getAdminSupabase();
        const { searchParams } = new URL(request.url);
        const journeyId = searchParams.get('journey_id');
        const schoolsCatalog = searchParams.get('schools');
        const reqAllVuelos = searchParams.get('all_vuelos');

        // Bulk: fetch ALL vuelos that belong to a journey (for fast Excel grouping)
        if (reqAllVuelos) {
            const { data, error } = await supabase
                .from('bitacora_vuelos')
                .select('id, mission_id, journey_id, student_count, staff_count, duration_seconds, start_time, end_time, created_at')
                .not('journey_id', 'is', null)
                .order('created_at', { ascending: true });

            if (error) throw error;
            return NextResponse.json({ data: data || [] });
        }

        // School catalog for ghost row select
        if (schoolsCatalog) {
            const { data, error } = await supabase
                .from('proximas_escuelas')
                .select('id, nombre_escuela, colonia')
                .order('nombre_escuela', { ascending: true });

            if (error) throw error;
            return NextResponse.json({ data: data || [] });
        }

        // Detail: fetch vuelos for a specific journey
        if (journeyId) {
            const { data, error } = await supabase
                .from('bitacora_vuelos')
                .select('id, mission_id, journey_id, student_count, staff_count, duration_seconds, start_time, end_time, created_at')
                .eq('journey_id', journeyId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return NextResponse.json({ data: data || [] });
        }

        // Master: fetch journeys with resolved school names + vuelo counts
        const { data: rawJourneys, error: rawError } = await supabase
            .from('staff_journeys')
            .select('id, date, school_name, school_id, status, tipo_escuela, cct, direccion, nombre_director, telefono_director, tarifa_base, cuota_alumno, numero_sector, numero_zona, created_at')
            .order('created_at', { ascending: false });

        if (rawError) throw rawError;

        // Fetch the school catalog for name resolution
        const { data: schools } = await supabase
            .from('proximas_escuelas')
            .select('id, nombre_escuela, colonia');

        const schoolMap = {};
        if (schools) {
            for (const s of schools) {
                schoolMap[s.id] = s;
            }
        }

        // Get vuelo counts AND student sums per journey
        let countsMap = {};
        let studentSumMap = {};
        const { data: allVuelos } = await supabase
            .from('bitacora_vuelos')
            .select('journey_id, student_count');

        if (allVuelos) {
            for (const v of allVuelos) {
                if (v.journey_id) {
                    countsMap[v.journey_id] = (countsMap[v.journey_id] || 0) + 1;
                    studentSumMap[v.journey_id] = (studentSumMap[v.journey_id] || 0) + (v.student_count || 0);
                }
            }
        }

        // Get totals from cierres_mision (total_students, total_flights)
        // Fetch ALL fields needed to detect orphans and create synthetic rows
        const { data: cierres } = await supabase
            .from('cierres_mision')
            .select('id, journey_id, total_students, total_flights, becados, school_name_snapshot, school_id, end_time, created_at');

        const cierreMap = {};
        if (cierres) {
            for (const c of cierres) {
                if (c.journey_id) {
                    cierreMap[c.journey_id] = c;
                }
            }
        }

        // Enrich journeys: resolve school_name via COALESCE logic + add vuelo_count
        // Priority: cierre (sealed/manual) ALWAYS wins over live bitacora when present
        const journeyIdSet = new Set((rawJourneys || []).map(j => j.id));
        const enriched = (rawJourneys || []).map(j => {
            const school = schoolMap[j.school_id];
            const cierre = cierreMap[j.id];
            const liveStudents = studentSumMap[j.id] || 0;
            const liveFlights = countsMap[j.id] || 0;
            return {
                ...j,
                school_name: j.school_name || (school?.nombre_escuela) || null,
                colonia: school?.colonia || null,
                vuelo_count: liveFlights,
                // SSoT: cierre (manual edits) ALWAYS takes priority when it exists.
                // Only fall back to live bitacora sums when there is no cierre record.
                total_students: cierre ? (cierre.total_students ?? 0) : liveStudents,
                total_flights:  cierre ? (cierre.total_flights ?? 0)  : liveFlights,
                becados:        cierre?.becados ?? 0,
                _has_cierre: !!cierre,  // Flag: does this row have a sealed cierre?
                _is_orphan: false,      // Normal journey rows are NOT orphans
            };
        });

        // ── SSoT: Include orphan cierres (records with no matching journey) ──
        // These are cierres whose journey was deleted or never created.
        // They MUST appear in the sandbox table to maintain data integrity.
        if (cierres) {
            for (const c of cierres) {
                const hasMatchingJourney = c.journey_id && journeyIdSet.has(c.journey_id);
                if (!hasMatchingJourney) {
                    const school = c.school_id ? schoolMap[c.school_id] : null;
                    enriched.push({
                        id: c.journey_id || `orphan-${c.id}`,
                        date: c.end_time ? c.end_time.split('T')[0] : (c.created_at ? c.created_at.split('T')[0] : null),
                        school_name: c.school_name_snapshot || school?.nombre_escuela || '(Registro sin journey)',
                        school_id: c.school_id || null,
                        status: 'closed',
                        tipo_escuela: null,
                        cct: null,
                        direccion: null,
                        nombre_director: null,
                        telefono_director: null,
                        tarifa_base: null,
                        cuota_alumno: null,
                        numero_sector: null,
                        numero_zona: null,
                        created_at: c.created_at,
                        colonia: school?.colonia || null,
                        vuelo_count: 0,
                        total_students: c.total_students ?? 0,
                        total_flights: c.total_flights ?? 0,
                        becados: c.becados ?? 0,
                        _is_orphan: true, // Flag for UI (optional)
                    });
                }
            }
        }

        return NextResponse.json({ data: enriched });
    } catch (err) {
        console.error('[API] sandbox-vuelos GET error:', err);
        return NextResponse.json(
            { error: err.message || 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

// PATCH — update a single field on a single row
// For total_students / total_flights: UPSERT into cierres_mision + set status=closed
export async function PATCH(request) {
    try {
        const { id, field, value, table } = await request.json();
        const targetTable = table || 'bitacora_vuelos';

        if (!id || !field) {
            return NextResponse.json(
                { error: 'id and field are required' },
                { status: 400 }
            );
        }

        const supabase = getAdminSupabase();

        // ── ORPHAN HANDLING: If the ID starts with 'orphan-', this row only exists in cierres_mision ──
        const isOrphanEdit = id.startsWith('orphan-') || id.startsWith('orphan_');

        // Special path: Niños/Vuelos/Becados → UPSERT cierres_mision ONLY
        // ⚠️ Does NOT change journey status — that should only happen from the PWA
        // when staff actually closes the operation in the field.
        if (targetTable === 'staff_journeys' && ['total_students', 'total_flights', 'becados'].includes(field)) {
            const numValue = Number(value);
            if (!Number.isFinite(numValue) || numValue < 0) {
                return NextResponse.json(
                    { error: `Valor inválido: "${value}" no es un número válido.` },
                    { status: 400 }
                );
            }
            const safeValue = Math.round(numValue); // Students/flights/becados are always integers

            if (isOrphanEdit) {
                // Orphan with 'orphan-' prefix: update cierres_mision directly by cierre ID
                const cierreId = id.replace(/^orphan[-_]/, '');
                const { error: upErr } = await supabase
                    .from('cierres_mision')
                    .update({ [field]: safeValue })
                    .eq('id', cierreId);
                if (upErr) throw upErr;
                return NextResponse.json({ data: { id, [field]: safeValue, status: 'closed' } });
            }

            // Try to get journey data — use .maybeSingle() to avoid crash when journey was deleted
            const { data: journey, error: jErr } = await supabase
                .from('staff_journeys')
                .select('id, school_id, school_name, date, status')
                .eq('id', id)
                .maybeSingle();

            if (jErr) throw jErr;

            // ── ORPHAN WITH VALID UUID: journey was deleted but cierre still references it ──
            // This is the key fix: if the journey doesn't exist, update cierre directly by journey_id
            if (!journey) {
                const { error: upErr } = await supabase
                    .from('cierres_mision')
                    .update({ [field]: safeValue })
                    .eq('journey_id', id);
                if (upErr) throw upErr;
                return NextResponse.json({ data: { id, [field]: safeValue, status: 'closed' } });
            }

            // Resolve school name
            let schoolName = journey.school_name;
            if (!schoolName && journey.school_id) {
                const { data: school } = await supabase
                    .from('proximas_escuelas')
                    .select('nombre_escuela')
                    .eq('id', journey.school_id)
                    .maybeSingle();
                schoolName = school?.nombre_escuela || null;
            }

            // Check if cierre already exists — use .limit(1) instead of .maybeSingle()
            // to handle duplicate cierres gracefully without crashing
            const { data: existingArr } = await supabase
                .from('cierres_mision')
                .select('id, total_students, total_flights, becados')
                .eq('journey_id', id)
                .limit(1);

            const existing = existingArr?.[0] || null;

            if (existing) {
                // UPDATE existing cierre(s) — only touch the single field being edited
                // Using .eq('journey_id', id) updates ALL duplicates (if any), which is correct
                const { error: upErr } = await supabase
                    .from('cierres_mision')
                    .update({ [field]: safeValue })
                    .eq('journey_id', id);
                if (upErr) throw upErr;
            } else {
                // INSERT new cierre — initialize ALL 3 numeric fields to 0,
                // then override the one being edited. This prevents the bug where
                // editing one field would leave the others as null.
                const { error: insErr } = await supabase
                    .from('cierres_mision')
                    .insert({
                        journey_id: id,
                        mission_id: journey.school_id ? String(journey.school_id) : null,
                        school_name_snapshot: schoolName,
                        school_id: journey.school_id,
                        total_students: 0,
                        total_flights: 0,
                        becados: 0,
                        [field]: safeValue, // Override the specific field being edited
                        checklist_verified: false,
                        end_time: new Date().toISOString(),
                    });
                if (insErr) throw insErr;
            }

            // ✅ Return current status — do NOT change it
            return NextResponse.json({ data: { id, [field]: safeValue, status: journey.status } });
        }

        // ── ORPHAN: For non-cierre fields on orphan records, update cierres_mision directly ──
        // This handles BOTH 'orphan-' prefixed IDs AND valid UUIDs whose journey was deleted
        if (isOrphanEdit) {
            const cierreId = id.replace(/^orphan[-_]/, '');
            // Only allow updating fields that exist on cierres_mision
            const cierreEditableFields = ['school_name_snapshot'];
            // Map staff_journeys field names to cierres_mision equivalents
            const fieldMap = { school_name: 'school_name_snapshot' };
            const cierreField = fieldMap[field] || field;

            if (cierreEditableFields.includes(cierreField)) {
                const { error: upErr } = await supabase
                    .from('cierres_mision')
                    .update({ [cierreField]: value })
                    .eq('id', cierreId);
                if (upErr) throw upErr;
                return NextResponse.json({ data: { id, [field]: value } });
            } else {
                // Field not editable on orphan records — return graceful message
                return NextResponse.json(
                    { error: `El campo "${field}" no se puede editar en registros huérfanos. Este registro solo existe en cierres_mision.` },
                    { status: 400 }
                );
            }
        }

        // Standard path: update a field on the target table
        const editableFields = {
            bitacora_vuelos: ['mission_id', 'student_count', 'duration_seconds', 'start_time', 'end_time'],
            staff_journeys: ['date', 'school_name', 'tipo_escuela', 'status', 'cct', 'direccion', 'nombre_director', 'telefono_director', 'tarifa_base', 'cuota_alumno', 'numero_sector', 'numero_zona'],
        };

        const allowed = editableFields[targetTable];
        if (!allowed || !allowed.includes(field)) {
            return NextResponse.json(
                { error: `Field "${field}" is not editable on table "${targetTable}"` },
                { status: 403 }
            );
        }

        // Before updating, verify the row exists (guards against orphan UUIDs reaching here)
        const { data, error } = await supabase
            .from(targetTable)
            .update({ [field]: value })
            .eq('id', id)
            .select();

        if (error) throw error;

        // If no rows were updated, this ID might be an orphan with a valid UUID
        if (!data || data.length === 0) {
            // Try to update cierre directly for school_name field
            if (field === 'school_name') {
                const { error: cErr } = await supabase
                    .from('cierres_mision')
                    .update({ school_name_snapshot: value })
                    .eq('journey_id', id);
                if (cErr) console.warn('[API] orphan school_name update failed:', cErr);
                return NextResponse.json({ data: { id, [field]: value } });
            }
            return NextResponse.json(
                { error: `No se encontró el registro con id "${id}" en ${targetTable}. Puede ser un registro huérfano.` },
                { status: 404 }
            );
        }

        // Sync school_name → cierres_mision.school_name_snapshot
        if (targetTable === 'staff_journeys' && field === 'school_name' && value) {
            const { error: syncErr } = await supabase
                .from('cierres_mision')
                .update({ school_name_snapshot: value })
                .eq('journey_id', id);
            if (syncErr) {
                console.warn('[API] school_name_snapshot sync failed (non-blocking):', syncErr);
            }
        }

        return NextResponse.json({ data: data?.[0] || null });
    } catch (err) {
        console.error('[API] sandbox-vuelos PATCH error:', err);
        return NextResponse.json(
            { error: err.message || 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

// POST — Ghost Row: auto-create school in catalog + double INSERT (staff_journeys + cierres_mision)
export async function POST(request) {
    try {
        const { school_name, date, total_students, total_flights, becados, tipo_escuela, cct, direccion, nombre_director, telefono_director, tarifa_base, cuota_alumno } = await request.json();

        if (!school_name?.trim() || !date) {
            return NextResponse.json(
                { error: 'school_name and date are required' },
                { status: 400 }
            );
        }

        const supabase = getAdminSupabase();
        const trimmedName = school_name.trim();

        // Auto-catalog: check if school already exists in proximas_escuelas
        const { data: existing } = await supabase
            .from('proximas_escuelas')
            .select('id, nombre_escuela')
            .ilike('nombre_escuela', trimmedName)
            .limit(1)
            .maybeSingle();

        let schoolId = existing?.id || null;

        // If not found, create it in the catalog
        if (!existing) {
            const { data: newSchool, error: schoolErr } = await supabase
                .from('proximas_escuelas')
                .insert({
                    nombre_escuela: trimmedName,
                    colonia: '',
                    fecha_programada: date,
                    estatus: 'completada',
                })
                .select('id')
                .single();

            if (schoolErr) throw schoolErr;
            schoolId = newSchool.id;
        }

        // Step 1: INSERT into staff_journeys
        const { data: newJourney, error: jErr } = await supabase
            .from('staff_journeys')
            .insert({
                date,
                school_id: schoolId,
                school_name: trimmedName,
                status: 'closed',
                tipo_escuela: tipo_escuela || null,
                cct: cct || null,
                direccion: direccion || null,
                nombre_director: nombre_director || null,
                telefono_director: telefono_director || null,
                tarifa_base: tarifa_base ? Number(tarifa_base) : null,
                cuota_alumno: cuota_alumno ? Number(cuota_alumno) : null,
            })
            .select()
            .single();

        if (jErr) throw jErr;

        // Step 2: INSERT into cierres_mision
        const { error: cErr } = await supabase
            .from('cierres_mision')
            .insert({
                journey_id: newJourney.id,
                mission_id: schoolId ? String(schoolId) : null,
                school_name_snapshot: trimmedName,
                school_id: schoolId,
                total_students: parseInt(total_students) || 0,
                total_flights: parseInt(total_flights) || 0,
                becados: parseInt(becados) || 0,
                checklist_verified: false,
                end_time: new Date().toISOString(),
            });

        if (cErr) throw cErr;

        return NextResponse.json({
            data: {
                ...newJourney,
                school_name: trimmedName,
                total_students: parseInt(total_students) || 0,
                total_flights: parseInt(total_flights) || 0,
                becados: parseInt(becados) || 0,
                vuelo_count: 0,
                cct: cct || null,
                direccion: direccion || null,
                nombre_director: nombre_director || null,
                telefono_director: telefono_director || null,
                tarifa_base: tarifa_base ? Number(tarifa_base) : null,
                cuota_alumno: cuota_alumno ? Number(cuota_alumno) : null,
            },
        });
    } catch (err) {
        console.error('[API] sandbox-vuelos POST error:', err);
        return NextResponse.json(
            { error: err.message || 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

// DELETE — cascade delete: bitacora_vuelos children first, then staff_journeys parent, + DEEP CLEAN STORAGE
export async function DELETE(request) {
    try {
        const { journeyId } = await request.json();

        if (!journeyId) {
            return NextResponse.json(
                { error: 'journeyId is required' },
                { status: 400 }
            );
        }

        const supabase = getAdminSupabase();

        // --- ORPHAN HANDLING: Si el journeyId es de un registro sin parent staff_journey
        const isOrphan = journeyId.startsWith('orphan-');
        if (isOrphan) {
            const cierreId = journeyId.replace('orphan-', '');
            const filesToDelete = [];
            
            // 1) Obtener evidencias aisalas
            const { data: cierreDetails } = await supabase
                .from('cierres_mision')
                .select('group_photo_url, signature_url')
                .eq('id', cierreId)
                .maybeSingle();

            if (cierreDetails) {
                if (cierreDetails.group_photo_url) {
                    const path = cierreDetails.group_photo_url.split('/escuelas_fotos/')[1] || (!cierreDetails.group_photo_url.startsWith('http') ? cierreDetails.group_photo_url : null);
                    if (path) filesToDelete.push(path);
                }
                if (cierreDetails.signature_url) {
                    const path = cierreDetails.signature_url.split('/escuelas_fotos/')[1] || (!cierreDetails.signature_url.startsWith('http') ? cierreDetails.signature_url : null);
                    if (path) filesToDelete.push(path);
                }
            }
            
            // 2) Destruir fisicamente
            if (filesToDelete.length > 0) {
                try {
                    await supabase.storage.from('escuelas_fotos').remove(filesToDelete);
                } catch(e) { console.warn('Storage orphan delete error:', e); }
            }
            
            // 3) Borrar el registro fantasma
            const { error: orpErr } = await supabase.from('cierres_mision').delete().eq('id', cierreId);
            if (orpErr) throw new Error(`Error eliminando cierre huérfano: ${orpErr.message}`);
            
            return NextResponse.json({ message: 'Registro huérfano purgado exitosamente' });
        }

        // --- NORMAL OPERATION ---
        // Step -1: Rescatar el Origin ID (school_id) para purgar también el Cronograma (SSoT)
        const { data: targetJourney } = await supabase
            .from('staff_journeys')
            .select('school_id')
            .eq('id', journeyId)
            .single();
            
        const originSchoolId = targetJourney?.school_id;

        // Step 0: Recolección y destrucción profunda de Evidencia Físcia (Tierra Arrasada)
        const filesToDelete = [];
        
        // A) Fotos y firmas finales de cierres_mision
        const { data: cierres } = await supabase
            .from('cierres_mision')
            .select('group_photo_url, signature_url')
            .eq('journey_id', journeyId);
            
        if (cierres && cierres.length > 0) {
            for (const c of cierres) {
                if (c.group_photo_url) {
                    const path = c.group_photo_url.split('/escuelas_fotos/')[1] || (!c.group_photo_url.startsWith('http') ? c.group_photo_url : null);
                    if (path) filesToDelete.push(path);
                }
                if (c.signature_url) {
                    const path = c.signature_url.split('/escuelas_fotos/')[1] || (!c.signature_url.startsWith('http') ? c.signature_url : null);
                    if (path) filesToDelete.push(path);
                }
            }
        }
        
        // B) Reportes documentales de staff_prep_photos
        const { data: prepPhotos } = await supabase
            .from('staff_prep_photos')
            .select('photo_url')
            .eq('journey_id', journeyId);
            
        if (prepPhotos && prepPhotos.length > 0) {
            for (const p of prepPhotos) {
                if (p.photo_url) {
                    const path = p.photo_url.split('/escuelas_fotos/')[1] || (!p.photo_url.startsWith('http') ? p.photo_url : null);
                    if (path) filesToDelete.push(path);
                }
            }
        }
        
        // C) Ejecutar obliteración física masiva en Storage
        if (filesToDelete.length > 0) {
            try {
               const { error: storageErr } = await supabase.storage
                   .from('escuelas_fotos')
                   .remove(filesToDelete);
               if (storageErr) console.warn('[API] Error incinerando evidencia Storage:', storageErr);
            } catch(e) { console.warn('[API] Try/catch incinerando Storage fallo:', e); }
        }

        // Step 1: Vuelos unitarios
        const { error: vuelosError } = await supabase
            .from('bitacora_vuelos')
            .delete()
            .eq('journey_id', journeyId);

        if (vuelosError) {
            throw new Error(`Error eliminando vuelos: ${vuelosError.message}`);
        }

        // Step 2: Cierres documentales
        await supabase.from('cierres_mision').delete().eq('journey_id', journeyId);

        // Step 3: Evidencias documentales y logísticas
        await supabase.from('staff_prep_events').delete().eq('journey_id', journeyId);
        await supabase.from('staff_prep_photos').delete().eq('journey_id', journeyId);
        await supabase.from('staff_events').delete().eq('journey_id', journeyId);
        
        // Step 4: Desvincular existencias de personal
        await supabase.from('staff_presence').update({ journey_id: null }).eq('journey_id', journeyId);

        // Step 5: Corte de raíz absoluto de la misión
        const { error: journeyError } = await supabase
            .from('staff_journeys')
            .delete()
            .eq('id', journeyId);

        if (journeyError) {
            throw new Error(`Error en el golpe final (journey delete): ${journeyError.message}`);
        }
        
        // Step 6: Limpieza en el Cronograma (Cascade Delete paramétrico SSoT)
        // Al matar esto, la PWA también borrará automáticamente la asignación.
        if (originSchoolId) {
            await supabase
                .from('proximas_escuelas')
                .delete()
                .eq('id', originSchoolId);
        }

        return NextResponse.json({
            success: true,
            message: `Journey eliminado de raíz operativa y logística (Cronograma).`,
        });
    } catch (err) {
        console.error('[API] sandbox-vuelos DELETE error:', err);
        return NextResponse.json(
            { error: err.message || 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
