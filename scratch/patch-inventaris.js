const fs = require('fs');
let code = fs.readFileSync('src/components/warung/inventaris-view.tsx', 'utf8');

console.log('Has import-product-dialog:', code.includes('import-product-dialog'));
console.log('Has canMutateInventory = true:', code.includes('canMutateInventory = true'));
console.log('Has currentRole !== kasir:', code.includes('currentRole !== "kasir"'));
console.log('Has ImportProductDialog tag:', code.includes('<ImportProductDialog'));

// Fix 1: Add import if missing
if (!code.includes('import-product-dialog')) {
  code = code.replace(
    'import { InfoHint } from "@/components/tokomu/info-hint";',
    'import { InfoHint } from "@/components/tokomu/info-hint";\nimport { ImportProductDialog } from "@/components/tokomu/import-product-dialog";'
  );
  console.log('-> Added import');
}

// Fix 2: Change canMutateInventory if needed
if (code.includes('currentRole !== "kasir"')) {
  code = code.replace(
    'const canMutateInventory = currentRole !== "kasir";',
    'const canMutateInventory = true;'
  );
  console.log('-> Fixed canMutateInventory');
}

// Fix 3: Add button if missing
if (!code.includes('<ImportProductDialog')) {
  // The button goes after the </Button> that closes Restok via Scan Struk
  // and before <Dialog open={createOpen}
  const marker = 'Restok via Scan Struk';
  const markerIdx = code.indexOf(marker);
  if (markerIdx === -1) {
    console.log('ERROR: Cannot find "Restok via Scan Struk"');
  } else {
    // Find the next </Button> after marker
    const afterMarker = code.indexOf('</Button>', markerIdx);
    if (afterMarker === -1) {
      console.log('ERROR: Cannot find </Button> after marker');
    } else {
      const buttonEnd = afterMarker + '</Button>'.length;
      // Insert after the </Button> and before whatever comes next
      const before = code.substring(0, buttonEnd);
      const after = code.substring(buttonEnd);
      // Detect line ending style
      const lineEnd = code.includes('\r\n') ? '\r\n' : '\n';
      code = before + lineEnd + '                <ImportProductDialog onImportComplete={() => window.location.reload()} />' + after;
      console.log('-> Added ImportProductDialog button');
    }
  }
}

fs.writeFileSync('src/components/warung/inventaris-view.tsx', code);
console.log('Done! Final checks:');
console.log('Has import-product-dialog:', code.includes('import-product-dialog'));
console.log('Has canMutateInventory = true:', code.includes('canMutateInventory = true'));
console.log('Has ImportProductDialog tag:', code.includes('<ImportProductDialog'));
