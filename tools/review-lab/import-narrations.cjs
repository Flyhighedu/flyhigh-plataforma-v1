const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const { createClient } = require('@supabase/supabase-js');

const projectRoot = path.resolve(__dirname, '..', '..');

function readEnvironment(fileName) {
  const filePath = path.join(projectRoot, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Falta ${fileName}`);
  }
  return parseEnv(fs.readFileSync(filePath, 'utf8'));
}

function createAdminClient(environment, label) {
  const url = environment.NEXT_PUBLIC_SUPABASE_URL;
  const key = environment.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error(`${label}: configuración incompleta`);
  return {
    client: createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    }),
    url: new URL(url)
  };
}

function assertSafeDestination(url) {
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
    throw new Error(`Destino rechazado: ${url.hostname}. Solo se permite la base local de revisión.`);
  }
}

function pick(record, fields) {
  return Object.fromEntries(fields.map((field) => [field, record[field]]));
}

function fileExtension(rawUrl) {
  try {
    const extension = path.extname(new URL(rawUrl).pathname).toLowerCase();
    return extension && extension.length <= 8 ? extension : '.wav';
  } catch {
    return '.wav';
  }
}

async function ensurePublicBucket(client, bucket) {
  const { data: buckets, error: listError } = await client.storage.listBuckets();
  if (listError) throw listError;
  if (buckets?.some((item) => item.name === bucket)) return;
  const { error: createError } = await client.storage.createBucket(bucket, { public: true });
  if (createError) throw createError;
}

async function localizeAudioFiles(sourcePois, targetClient) {
  const bucket = 'poi-audio';
  await ensurePublicBucket(targetClient, bucket);

  const localized = [];
  for (const poi of sourcePois) {
    const response = await fetch(poi.audio_url);
    if (!response.ok) {
      throw new Error(`No se pudo descargar el audio de ${poi.name} (${response.status}).`);
    }

    const contentType = response.headers.get('content-type') || 'audio/wav';
    if (!contentType.startsWith('audio/')) {
      throw new Error(`El archivo de ${poi.name} no fue reconocido como audio.`);
    }

    const objectPath = `official/${poi.id}${fileExtension(poi.audio_url)}`;
    const bytes = Buffer.from(await response.arrayBuffer());
    const { error: uploadError } = await targetClient.storage
      .from(bucket)
      .upload(objectPath, bytes, { contentType, upsert: true });
    if (uploadError) throw uploadError;

    const { data: publicData } = targetClient.storage.from(bucket).getPublicUrl(objectPath);
    localized.push({ ...poi, audio_url: publicData.publicUrl });
  }

  return localized;
}

async function syncNarrations() {
  const sourceEnvironment = readEnvironment('.env.local');
  const targetEnvironment = readEnvironment('.env.review.local');
  const source = createAdminClient(sourceEnvironment, 'Fuente');
  const target = createAdminClient(targetEnvironment, 'Destino');

  assertSafeDestination(target.url);
  if (['127.0.0.1', 'localhost'].includes(source.url.hostname)) {
    throw new Error('La fuente también es local; no hay un catálogo principal que importar.');
  }

  const { data: routes, error: routeError } = await source.client
    .from('master_routes')
    .select('*')
    .eq('title', 'Directorio Global')
    .order('updated_at', { ascending: false });
  if (routeError) throw routeError;
  if (!routes?.length) throw new Error('No se encontró Directorio Global en la fuente.');

  const route = routes[0];
  const { data: pois, error: poiError } = await source.client
    .from('master_route_pois')
    .select('*')
    .eq('route_id', route.id)
    .order('sort_order', { ascending: true });
  if (poiError) throw poiError;
  if (!pois?.length) throw new Error('Directorio Global no contiene narraciones.');

  const incomplete = pois.filter((poi) => !poi.narrative_script || !poi.audio_url);
  if (incomplete.length) {
    throw new Error(`Importación detenida: ${incomplete.length} registros oficiales están incompletos.`);
  }

  const localizedPois = await localizeAudioFiles(pois, target.client);

  const routeFields = [
    'id', 'title', 'description', 'emoji', 'status', 'sort_order',
    'created_at', 'updated_at', 'published_at'
  ];
  const poiFields = [
    'id', 'route_id', 'name', 'description', 'image_url', 'lat', 'lng',
    'dato_clave_1', 'dato_clave_2', 'dato_clave_3',
    'pregunta_estudio_1', 'pregunta_estudio_2', 'pregunta_estudio_3',
    'pregunta_interaccion', 'ai_context', 'sort_order', 'created_at', 'updated_at',
    'narrative_script', 'audio_url', 'audio_duration_seconds', 'audio_generated_at',
    'research_article', 'is_general_topic', 'trigger_keywords'
  ];

  const { error: routeUpsertError } = await target.client
    .from('master_routes')
    .upsert(pick(route, routeFields), { onConflict: 'id' });
  if (routeUpsertError) throw routeUpsertError;

  const { error: poiUpsertError } = await target.client
    .from('master_route_pois')
    .upsert(localizedPois.map((poi) => pick(poi, poiFields)), { onConflict: 'id' });
  if (poiUpsertError) throw poiUpsertError;

  const { count, error: verifyError } = await target.client
    .from('master_route_pois')
    .select('*', { count: 'exact', head: true })
    .eq('route_id', route.id)
    .not('narrative_script', 'is', null)
    .not('audio_url', 'is', null);
  if (verifyError) throw verifyError;
  if (count !== localizedPois.length) {
    throw new Error(`Verificación falló: se esperaban ${localizedPois.length} narraciones completas y se encontraron ${count}.`);
  }

  return {
    imported: count,
    route: route.title,
    source: source.url.hostname,
    destination: target.url.hostname,
    audioMode: 'archivos copiados al almacenamiento local'
  };
}

if (require.main === module) {
  syncNarrations()
    .then((result) => process.stdout.write(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(`No se pudieron sincronizar las narraciones: ${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = { syncNarrations };
