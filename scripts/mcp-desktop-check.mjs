// Verify the desktop entrypoint without any web server or network dependency.
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const folder=await mkdtemp(join(tmpdir(),'loop-desktop-check-'));
const guard=join(folder,'no-network.mjs');
await writeFile(guard,"globalThis.fetch=()=>{throw new Error('Network access is disabled for the desktop regression');};");
async function connect(){
  const transport=new StdioClientTransport({command:process.execPath,args:['--import',guard,'--import','tsx','server/mcp/stdio.ts'],cwd:resolve('.'),stderr:'pipe',env:{MCP_TOKEN_SECRET:'isolated-desktop-smoke-secret-long-enough',LOOP_STDIO_DATABASE:join(folder,'studio.sqlite'),LOOP_STDIO_OWNER_PATH:join(folder,'owner')}});
  let diagnostic='';
  transport.stderr?.on('data',chunk=>{diagnostic+=chunk.toString();});
  const client=new Client({name:'desktop-regression',version:'1.0'});
  try{await client.connect(transport);return client;}catch(error){await client.close();throw new Error('Desktop connection failed: '+diagnostic.slice(-4000),{cause:error});}
}
let client;
try{
  client=await connect();
  assert.equal((await client.listTools()).tools.length,11);
  const catalog=await client.callTool({name:'loop_get_catalog',arguments:{}});
  const example=catalog.structuredContent.examples.find(item=>item.config.templateId==='hero');
  const preview=await client.callTool({name:'loop_preview_design',arguments:{name:'Offline desktop check',config:example.config}});
  assert.equal(preview.isError,undefined);
  const resource=await client.readResource({uri:'ui://loop/design-v2.html'});
  assert.ok(Buffer.byteLength(JSON.stringify(resource))<10*1024*1024,'Initial UI must fit the default SDK message budget');
  assert.ok(resource.contents[0].text.includes('data:image/png;base64'));
  const asset=await client.callTool({name:'loop_get_preview_asset',arguments:{path:'/assets/models/atelier-tote.glb'}});
  assert.equal(asset.isError,undefined);
  assert.ok(Buffer.byteLength(JSON.stringify(asset))<10*1024*1024);
  assert.ok(asset._meta.asset.base64.length>0);
  const saved=await client.callTool({name:'loop_save_design',arguments:{name:'Offline desktop check',config:example.config}});
  assert.equal(saved.isError,undefined);
  assert.equal(saved.structuredContent.studioUrl,undefined);
  const id=saved.structuredContent.design.id;
  await client.close();
  client=await connect();
  const reloaded=await client.callTool({name:'loop_get_design',arguments:{id}});
  assert.equal(reloaded.isError,undefined);
  assert.equal(reloaded.structuredContent.design.id,id);
  assert.equal((await client.callTool({name:'loop_list_orders',arguments:{}})).structuredContent.total,0);
  console.log('PASS: desktop stdio initializes with all network access blocked, supplies the embedded UI, saves in isolated storage and reloads the same draft after reconnect. No website dependency or test orders.');
}finally{await client?.close();await rm(folder,{recursive:true,force:true});}
