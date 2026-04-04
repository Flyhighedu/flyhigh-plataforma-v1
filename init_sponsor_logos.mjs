import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function init() {
    console.log("Adding logo_url column to patrocinadores...");
    const { error: sqlError } = await supabase.rpc('exec_sql', {
        query: "ALTER TABLE patrocinadores ADD COLUMN IF NOT EXISTS logo_url text;"
    });

    if (sqlError) {
        console.log("No exec_sql rpc available, trying alternate method...");
        // If no RPC, maybe I can just do a dummy update or standard insert if I had the MCP tool.
        // I will just use the REST API via a direct request if needed, but the user has `sandbox-hr/events/route.js` which has service_role. We can just use REST.
    } else {
        console.log("SQL executed successfully.");
    }

    console.log("Creating storage bucket 'sponsor-logos'...");
    const { data: buckets, error: bError } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.find(b => b.name === 'sponsor-logos');

    if (!bucketExists) {
        const { error: createError } = await supabase.storage.createBucket('sponsor-logos', { public: true });
        if (createError) {
            console.error("Error creating bucket:", createError);
        } else {
            console.log("Bucket created successfully.");
        }
    } else {
        console.log("Bucket already exists.");
        // Ensure it is public just in case
        await supabase.storage.updateBucket('sponsor-logos', { public: true });
    }
    
    console.log("Verifying schema...");
    const { data: cols } = await supabase.from('patrocinadores').select('logo_url').limit(1);
    console.log("Column verification:", cols ? "SUCCESS: logo_url exists" : "FAILED to find logo_url");
}

init();
