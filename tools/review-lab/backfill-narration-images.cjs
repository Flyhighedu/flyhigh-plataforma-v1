const {
  readEnvironment, createAdminClient, assertSafeDestination, localizeImageFiles
} = require('./import-narrations.cjs');

async function backfillNarrationImages() {
  const target = createAdminClient(readEnvironment('.env.review.local'), 'Destino');
  assertSafeDestination(target.url);

  const { data: routes, error: routeError } = await target.client
    .from('master_routes').select('id').eq('title', 'Directorio Global');
  if (routeError) throw routeError;
  if (!routes?.length) throw new Error('No se encontró Directorio Global en la Mesa local.');

  const { data: pois, error: poiError } = await target.client
    .from('master_route_pois').select('id, name, image_url').in('route_id', routes.map((route) => route.id));
  if (poiError) throw poiError;
  const withExternalImage = (pois || []).filter((poi) => poi.image_url && !poi.image_url.includes('/storage/v1/object/public/poi-images/'));
  const localized = await localizeImageFiles(withExternalImage, target.client);

  let updated = 0;
  for (let index = 0; index < withExternalImage.length; index++) {
    const original = withExternalImage[index];
    const image = localized[index];
    if (image.image_url === original.image_url) continue;
    const { data, error } = await target.client.from('master_route_pois')
      .update({ image_url: image.image_url })
      .eq('id', original.id).eq('image_url', original.image_url)
      .select('id').maybeSingle();
    if (error) throw error;
    if (data) updated++;
  }
  return { withExternalImage: withExternalImage.length, updated, destination: target.url.hostname };
}

if (require.main === module) {
  backfillNarrationImages()
    .then((result) => process.stdout.write(JSON.stringify(result, null, 2)))
    .catch((error) => { console.error(`No se pudieron copiar las imágenes: ${error.message}`); process.exitCode = 1; });
}

module.exports = { backfillNarrationImages };
