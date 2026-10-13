import { readFile, writeFile, rm } from 'node:fs/promises';
// 3D files are read through the card's app-only MCP tool, one bounded asset
// per message. Keep the initial HTML under desktop transport size limits.
await rm(new URL('../src/chatgpt/inlineAssets.generated.ts',import.meta.url),{force:true});
const partIds = ['amethyst', 'banana', 'cherry', 'clear', 'cupcake', 'flower', 'heart', 'jade', 'orange', 'pear', 'pearl', 'shell', 'star', 'wood'];
const thumbnails = await Promise.all(partIds.map(async id => [id, 'data:image/png;base64,' + (await readFile(new URL('../public/assets/thumbnails/part-'+id+'.png', import.meta.url))).toString('base64')]));
await writeFile(new URL('../src/chatgpt/partImages.generated.ts', import.meta.url),
  '// Generated from the studio product thumbnails.\nexport default ' + JSON.stringify(Object.fromEntries(thumbnails)) + ';\n');
console.log('Bundled '+thumbnails.length+' product thumbnails; 3D assets load through MCP without external fetches.');
