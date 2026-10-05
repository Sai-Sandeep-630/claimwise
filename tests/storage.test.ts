import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {readWorkspace,saveWorkspace} from '../lib/storage.ts';

test('REST adapter reads rows, uses only server headers and sends atomic RPC writes',async()=>{
 process.env.SUPABASE_URL='https://database.example';process.env.SUPABASE_SECRET_KEY='sb_secret_test_only';
 const calls:{url:string;init:RequestInit}[]=[];
 const mock=(async(url:any,init:any)=>{calls.push({url:String(url),init});return Response.json(calls.length===1?[{revision:1,data:{claims:[]}}]:false);}) as typeof fetch;
 const row=await readWorkspace('demo-reviewer',mock);assert.equal(row?.revision,1);
 assert.equal(await saveWorkspace('demo-reviewer',1,{claims:[]},mock),false);
 assert.equal((calls[0].init.headers as any).apikey,'sb_secret_test_only');assert.equal((calls[0].init.headers as any).Authorization,undefined);
 assert.ok(calls[1].url.endsWith('/rpc/save_claimwise_workspace'));
 assert.deepEqual(JSON.parse(calls[1].init.body as string),{p_owner:'demo-reviewer',p_expected_revision:1,p_data:{claims:[]}});
 delete process.env.SUPABASE_URL;delete process.env.SUPABASE_SECRET_KEY;
});
test('missing database configuration fails explicitly',async()=>{delete process.env.SUPABASE_URL;delete process.env.SUPABASE_SECRET_KEY;await assert.rejects(()=>readWorkspace('test'),/DATABASE_NOT_CONFIGURED/);});
test('REST adapter rejects provider failures and malformed response data',async()=>{
 process.env.SUPABASE_URL='https://database.example';process.env.SUPABASE_SECRET_KEY='sb_secret_test_only';
 await assert.rejects(()=>readWorkspace('test',(async()=>new Response('',{status:503})) as typeof fetch),/DATABASE_UNAVAILABLE/);
 await assert.rejects(()=>saveWorkspace('test',1,{claims:[]},(async()=>Response.json({success:true})) as typeof fetch),/DATABASE_RESPONSE_INVALID/);
 delete process.env.SUPABASE_URL;delete process.env.SUPABASE_SECRET_KEY;
});
test('Postgres schema enforces atomic revisions and denies browser roles',async()=>{
 const db=new PGlite();
 try{
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
 await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
 async function save(rev:number,data:any){return (await db.query<{saved:boolean}>('select public.save_claimwise_workspace($1,$2,$3::jsonb) as saved',['test',rev,JSON.stringify(data)])).rows[0].saved;}
 assert.equal(await save(0,{claims:[]}),true);assert.equal(await save(0,{claims:[]}),false);
 assert.equal(await save(1,{claims:[{id:'one'}]}),true);assert.equal(await save(1,{claims:[]}),false);
 const rows=(await db.query<{revision:number;data:any}>('select revision,data from public.claimwise_workspaces')).rows;
 assert.equal(rows[0].revision,2);assert.equal(rows[0].data.claims.length,1);
 const role=(await db.query<{allowed:boolean}>("select has_function_privilege('anon','public.save_claimwise_workspace(text,integer,jsonb)','EXECUTE') as allowed")).rows[0];assert.equal(role.allowed,false);
 const table=(await db.query<{allowed:boolean}>("select has_table_privilege('authenticated','public.claimwise_workspaces','SELECT') as allowed")).rows[0];assert.equal(table.allowed,false);
 await assert.rejects(()=>save(2,{invalid:true}));
 }finally{await db.close();}
});
