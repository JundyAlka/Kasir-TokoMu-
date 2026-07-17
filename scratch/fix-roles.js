const fs = require('fs');
const path = require('path');
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      results.push(file);
    }
  });
  return results;
}
const files = walk('src');
for (const file of files) {
  if (file.endsWith('.ts') || file.endsWith('.tsx')) {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;
    
    if (content.includes('await ["pimpinan", "pengelola_keuangan", "kasir"]')) {
       content = content.replace(/await \["pimpinan", "pengelola_keuangan", "kasir"\]/g, 'await requireRole(["pimpinan", "pengelola_keuangan", "kasir"])');
       changed = true;
    }
    
    if (changed) {
      fs.writeFileSync(file, content, 'utf8');
      console.log('Fixed ' + file);
    }
  }
}
