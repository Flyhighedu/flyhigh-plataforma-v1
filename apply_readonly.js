const fs = require('fs');

const pilotFile = 'src/components/staff/POIDetailModal.js';
let content = fs.readFileSync(pilotFile, 'utf8');

// 1. Title disabled
content = content.replace(
    "maxLength={100}",
    "maxLength={100}\n                        disabled={readOnly}"
);

// 2. Hide ENGINE SELECTOR DROPDOWN if readOnly
content = content.replace(
    "{/* ═══ ENGINE SELECTOR DROPDOWN ═══ */}\n                    <div style={{ position: 'relative', marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>",
    "{/* ═══ ENGINE SELECTOR DROPDOWN ═══ */}\n                    {!readOnly && <div style={{ position: 'relative', marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>"
);

content = content.replace(
    "                            </div>\n                        )}\n                    </div>",
    "                            </div>\n                        )}\n                    </div>}"
);

// 3. Hide IMAGE SELECTOR if readOnly
content = content.replace(
    "{/* ═══ IMAGE SELECTOR ═══ */}\n                        {(hasGeneratedFicha || selectedImageUrl || researchArticle) && (",
    "{/* ═══ IMAGE SELECTOR ═══ */}\n                        {!readOnly && (hasGeneratedFicha || selectedImageUrl || researchArticle) && ("
);

fs.writeFileSync(pilotFile, content, 'utf8');
console.log('Final readOnly constraints applied');
