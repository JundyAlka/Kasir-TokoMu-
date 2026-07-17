const fs = require('fs');
let code = fs.readFileSync('src/components/warung/inventaris-view.tsx', 'utf8');

// 1. Add import for ImportProductDialog
if (!code.includes('ImportProductDialog')) {
  code = code.replace(
    'import { InfoHint } from "@/components/tokomu/info-hint";',
    'import { InfoHint } from "@/components/tokomu/info-hint";\nimport { ImportProductDialog } from "@/components/tokomu/import-product-dialog";'
  );
  console.log('Added ImportProductDialog import');
}

// 2. Change canMutateInventory to always true
if (code.includes('currentRole !== "kasir"')) {
  code = code.replace(
    'const canMutateInventory = currentRole !== "kasir";',
    'const canMutateInventory = true;'
  );
  console.log('Changed canMutateInventory to true');
}

// 3. Add ImportProductDialog button between Restok and Tambah buttons
// We need to find the exact pattern including \r\n
const searchPattern = '</Button>\r\n                <Dialog open={createOpen}';
if (code.includes(searchPattern)) {
  code = code.replace(
    searchPattern,
    '</Button>\r\n                <ImportProductDialog onImportComplete={() => window.location.reload()} />\r\n                <Dialog open={createOpen}'
  );
  console.log('Added ImportProductDialog button (CRLF)');
} else {
  const searchPatternLF = '</Button>\n                <Dialog open={createOpen}';
  if (code.includes(searchPatternLF)) {
    code = code.replace(
      searchPatternLF,
      '</Button>\n                <ImportProductDialog onImportComplete={() => window.location.reload()} />\n                <Dialog open={createOpen}'
    );
    console.log('Added ImportProductDialog button (LF)');
  } else {
    console.log('ERROR: Could not find insertion point for ImportProductDialog button');
    // Try to find what comes after the Restok button
    const idx = code.indexOf('Restok via Scan Struk');
    if (idx !== -1) {
      const snippet = code.substring(idx, idx + 200);
      console.log('Context around "Restok via Scan Struk":', JSON.stringify(snippet));
    }
  }
}

fs.writeFileSync('src/components/warung/inventaris-view.tsx', code);
console.log('Done');
