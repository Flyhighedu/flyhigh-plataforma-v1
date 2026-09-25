const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createClient } = require('@supabase/supabase-js');
const { readEnv, validateEnvironment, ROLES } = require('./core.cjs');

async function main() {
  const root = path.resolve(__dirname, '../..');
  const input = readEnv(path.join(root, '.env.review.local'));
  validateEnvironment(input, readEnv(path.join(root, '.env.local')));
  const accounts = JSON.parse(fs.readFileSync(path.join(root, '.review-lab/test-accounts.json'), 'utf8'));
  const identities = new Set();
  for (const role of ROLES) {
    const account = accounts[role.id];
    assert.ok(account?.email && account?.password, `Falta la cuenta ${role.id}`);
    const client = createClient(input.NEXT_PUBLIC_SUPABASE_URL, input.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signed, error: signError } = await client.auth.signInWithPassword(account);
    if (signError) throw new Error(`${role.name}: ${signError.message}`);
    assert.ok(signed.user?.id);
    identities.add(signed.user.id);
    const { data: profile, error: profileError } = await client.from('staff_profiles')
      .select('role,is_active').eq('user_id', signed.user.id).single();
    if (profileError) throw new Error(`${role.name}: ${profileError.message}`);
    assert.equal(profile.role, role.id);
    assert.equal(profile.is_active, true);
    const { data: journey, error: journeyError } = await client.from('staff_journeys')
      .select('id,school_name').eq('meta->>review_lab', 'true').limit(1);
    if (journeyError) throw new Error(`${role.name}: ${journeyError.message}`);
    assert.ok(journey.length > 0, `${role.name}: falta jornada ficticia`);
    console.log(`${role.name}: acceso y jornada local correctos`);
  }
  assert.equal(identities.size, ROLES.length, 'Las cuatro sesiones deben ser cuentas distintas');
  console.log('Cuatro cuentas independientes verificadas en Supabase local.');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
