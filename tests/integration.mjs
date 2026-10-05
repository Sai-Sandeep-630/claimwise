// Run after npm run build. Uses only synthetic data and temporary secrets.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {createServer as createHTTPServer} from 'node:http';
import {PGlite} from '@electric-sql/pglite';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {createServer} from 'node:net';
const socket=createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
const origin=`http://127.0.0.1:${port}`,directory=await mkdtemp(join(tmpdir(),'claimwise-integration-'));
const password=randomBytes(24).toString('hex');
// Local test gateway uses the actual Postgres schema. It is not hosted Supabase.
const pg=new PGlite();
await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
await pg.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
const databaseKey=randomBytes(24).toString('hex');
const gateway=createHTTPServer(async(req,res)=>{
 try{
  if(req.headers.apikey!==databaseKey){res.writeHead(401);res.end();return;}
  const url=new URL(req.url,'http://localhost');
  let data;
  if(req.method==='GET'&&url.pathname==='/rest/v1/claimwise_workspaces'){
   const owner=url.searchParams.get('owner')?.slice(3);
   data=(await pg.query('select revision,data from public.claimwise_workspaces where owner=$1',[owner])).rows;
  }else if(req.method==='POST'&&url.pathname==='/rest/v1/rpc/save_claimwise_workspace'){
   let raw='';for await(const chunk of req)raw+=chunk;
   const body=JSON.parse(raw);
   data=(await pg.query('select public.save_claimwise_workspace($1,$2,$3::jsonb) as saved',[body.p_owner,body.p_expected_revision,JSON.stringify(body.p_data)])).rows[0].saved;
  }else{res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(data));
 }catch{res.writeHead(500);res.end();}
});
await new Promise(resolve=>gateway.listen(0,'127.0.0.1',resolve));
const databaseURL=`http://127.0.0.1:${gateway.address().port}`;
const env={...process.env,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',PORT:String(port),HOSTNAME:'127.0.0.1',APP_URL:origin,SUPABASE_URL:databaseURL,SUPABASE_SECRET_KEY:databaseKey,SESSION_SECRET:randomBytes(32).toString('hex'),REVIEWER_PASSWORD:password,GROQ_API_KEY:''};
const nativeFetch=globalThis.fetch;
globalThis.fetch=(url,options={})=>nativeFetch(url,{...options,signal:AbortSignal.timeout(4000)});
let child,output='';
async function start(){
 child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p',String(port)],{env,stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',d=>{output+=d.toString();process.stdout.write(d);});child.stderr.on('data',d=>{output+=d.toString();process.stderr.write(d);});
 for(let i=0;i<6;i++){if(child.exitCode!==null)throw new Error(output);try{if((await fetch(`${origin}/api/health`)).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}
 throw new Error('Production server did not start. '+output);
}
async function stop(){if(child&&child.exitCode===null){const p=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');const timer=setTimeout(()=>child.kill('SIGKILL'),3000);await p;clearTimeout(timer);}}
try{
 await start();
 assert.equal((await fetch(`${origin}/favicon.svg`)).status,200);
 assert.equal((await fetch(`${origin}/api/workspace`)).status,401);
 const wrong=await fetch(`${origin}/api/login`,{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded',Origin:origin},body:'password=wrong'});assert.equal(wrong.status,303);assert.ok(wrong.headers.get('location').includes('error=invalid'));
 const login=await fetch(`${origin}/api/login`,{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded',Origin:origin},body:new URLSearchParams({password})});assert.equal(login.status,303);
 const cookie=login.headers.get('set-cookie').split(';')[0];
 const headers={Cookie:cookie,Origin:origin,'Content-Type':'application/json'};
 const read=()=>fetch(`${origin}/api/workspace`,{headers});
 const post=body=>fetch(`${origin}/api/workspace`,{method:'POST',headers,body:JSON.stringify(body)});
 let r=await read(),state=await r.json();assert.equal(state.revision,0);assert.equal(state.aiConfigured,false);
 r=await post({action:'seed',revision:0});assert.equal(r.status,200);state=await r.json();assert.equal(state.workspace.claims.length,6);
 assert.equal((await post({action:'seed',revision:0})).status,409);
 const id=state.workspace.claims[0].id;
 assert.equal((await post({action:'review',revision:1,id})).status,503);
 assert.equal((await post({action:'approve',revision:1,id,reason:'Test'})).status,400);
 const badOrigin=await fetch(`${origin}/api/workspace`,{method:'POST',headers:{...headers,Origin:'https://untrusted.example'},body:JSON.stringify({action:'seed',revision:1})});assert.equal(badOrigin.status,403);
 r=await post({action:'clarify',revision:1,id,reason:'Please confirm attendees.'});assert.equal(r.status,200);state=await r.json();assert.equal(state.revision,2);
 r=await post({action:'amend',revision:2,id,description:'Business lunch with Ravi and Priya at client workshop.',receipt:true,reason:'Added attendees.'});assert.equal(r.status,200);
 r=await post({action:'reject',revision:3,id,reason:'Test reviewer decision.'});assert.equal(r.status,200);
 assert.equal((await post({action:'override',revision:4,id,category:'Travel',reason:'Test'})).status,400);
 r=await post({action:'reopen',revision:4,id,reason:'New information supplied.'});assert.equal(r.status,200);
 await stop();await start();
 r=await read();state=await r.json();assert.equal(state.revision,5);assert.equal(state.workspace.claims.length,6);assert.equal(state.workspace.claims.find(c=>c.id===id).status,'Pending');assert.equal(state.workspace.claims.find(c=>c.id===id).history.length,5);
 console.log('PASS: login, protected API, seed data, concurrency, missing-AI state, approval gate, origin check, clarification, amendment, rejection, reopen and Postgres-backed persistence after application restart (local REST gateway).');
}catch(error){console.error(output);throw error;}finally{await stop();await new Promise(resolve=>gateway.close(resolve));await pg.close();await rm(directory,{recursive:true,force:true});}
