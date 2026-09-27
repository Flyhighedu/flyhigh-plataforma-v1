// Explicit local-only example, never part of production setup or deployment.
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createClient } = require('@supabase/supabase-js');
const { readEnv, validateEnvironment } = require('./core.cjs');

async function seed() {
    const root = path.resolve(__dirname, '../..');
    const input = readEnv(path.join(root, '.env.review.local'));
    validateEnvironment(input, readEnv(path.join(root, '.env.local')));
    const { emptyNarration } = await import(pathToFileURL(path.join(root, 'src/lib/narrative-versions.mjs')));
    const client = createClient(input.NEXT_PUBLIC_SUPABASE_URL, input.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: point, error } = await client.from('master_route_pois').select('id,research_article,narrative_versions').eq('name', 'Parque Nacional Barranca del Cupatitzio').single();
    if (error) throw error;
    const research = `Barranca del Cupatitzio: base factual para una primera revisión educativa.
En Uruapan, Michoacán, este parque nacional protege un entorno natural donde nacen manantiales que forman el río Cupatitzio. La CONANP describe el área como un espacio de conservación y hábitat para distintas especies. [1]
La captación de lluvia y la recarga de los depósitos de agua subterránea forman parte de la importancia ambiental de esta zona. El agua del Cupatitzio contribuye al abastecimiento de Uruapan. [2]
El programa de manejo relaciona el río con el abastecimiento de agua para la población y con usos posteriores, entre ellos el riego. Estos beneficios conectan la conservación del parque con las necesidades de la comunidad. [3]
Esta síntesis no incorpora cifras de caudal, afirmaciones sobre potabilidad del agua observada, ni presenta leyendas como hechos. Las preguntas y acciones sugeridas en los guiones son propuestas didácticas de FlyHigh para revisión docente.
Fuentes oficiales:
[1] CONANP, ficha del área: https://descubreanp.conanp.gob.mx/es/conanp/ANP?suri=12
[2] SEMARNAT, Parque Nacional Barranca del Cupatitzio: https://www.gob.mx/semarnat/articulos/parque-nacional-barranca-del-cupatitzio?idiom=e
[3] CONANP, Programa de conservación y manejo: https://www.conanp.gob.mx/que_hacemos/pdf/programas_manejo/Libro_Cupatitzio.pdf`;
    const examples = {
        phase_2: ['Observar el agua del lugar y expresar una idea para cuidarla.', 'La Barranca del Cupatitzio está en Uruapan. Aquí el agua nace en manantiales y forma un río. Mientras observas este lugar, ¿qué te llama la atención del agua? Podemos cuidarlo dejando la basura en su sitio.'],
        phase_3: ['Relacionar una acción cotidiana con el cuidado del río.', 'En la Barranca del Cupatitzio nacen manantiales que forman un río. Está en Uruapan y su agua es importante para la comunidad. Cuidar este lugar empieza con acciones cercanas, como recoger nuestros residuos después de una visita. ¿Qué otra acción ayudaría a mantener limpio el entorno del río?'],
        phase_4: ['Explicar una relación entre el parque y las necesidades de la comunidad.', 'La Barranca del Cupatitzio, en Uruapan, conecta la naturaleza con la vida de la ciudad. La zona capta lluvia y ayuda a recargar el agua subterránea. Sus manantiales forman un río que contribuye al abastecimiento de la población. Conservar este entorno también importa para quienes necesitan esa agua cada día. ¿Cómo explicarías esta relación a otra persona?'],
        phase_5: ['Justificar una acción comunitaria para cuidar un recurso compartido.', 'La Barranca del Cupatitzio protege un entorno natural ligado al agua de Uruapan. Sus manantiales forman un río que contribuye al abastecimiento de la población y, más adelante, al riego. Es un recurso compartido por personas con distintas necesidades. Piensa en una acción que la comunidad podría realizar para cuidar este entorno. ¿Por qué esa acción ayudaría tanto a la naturaleza como a las personas?'],
        phase_6: ['Formular una pregunta investigable sobre la conservación del agua y sus usos.', 'La Barranca del Cupatitzio permite estudiar cómo se relacionan el agua y la sociedad. Esta zona de Uruapan capta lluvia y favorece la recarga del agua subterránea; sus manantiales forman un río aprovechado por la población y para el riego. Estos datos muestran que su conservación tiene consecuencias fuera del parque. ¿Qué información necesitaríamos reunir para comparar las necesidades de quienes utilizan el agua y proponer formas de cuidarla?'],
    };
    const versions = { ...(point.narrative_versions || {}) };
    let added = 0;
    for (const [id, [learning_goal, narrative_script]] of Object.entries(examples)) {
        if (versions[id]?.narrative_script) continue;
        versions[id] = { ...emptyNarration(), learning_goal, narrative_script, curriculum_focus: 'nature', review_note: id === 'phase_6' ? 'Borrador de ejemplo. Referente de Geografía de 1.º de secundaria; revisar pertinencia para 2.º y 3.º y contexto del grupo.' : 'Borrador de ejemplo. Revisar hechos, lenguaje y pertinencia para el grado y contexto del grupo.' };
        added++;
    }
    const { error: updateError } = await client.from('master_route_pois').update({ narrative_versions: versions, research_article: point.research_article || research }).eq('id', point.id);
    if (updateError) throw updateError;
    console.log(`Ejemplo local de Cupatitzio: ${added} borradores añadidos. General y audios existentes conservados.`);
}
if (require.main === module) seed().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { seed };
