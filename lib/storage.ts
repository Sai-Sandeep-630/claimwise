import type {Workspace} from './core';
export type StoredWorkspace={revision:number;data:Workspace};
/** Server-only REST access. No secrets or database calls are sent to the browser. */
async function request(path:string,init:RequestInit={},fetcher:typeof fetch=fetch){
 const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
 const key=process.env.SUPABASE_SECRET_KEY;
 if(!url||!key)throw new Error('DATABASE_NOT_CONFIGURED');
 const headers:Record<string,string>={'apikey':key,'Content-Type':'application/json'};
 // New secret keys use apikey; legacy service_role JWTs also need Bearer auth.
 if(!key.startsWith('sb_secret_'))headers.Authorization=`Bearer ${key}`;
 const response=await fetcher(`${url}/rest/v1/${path}`,{...init,headers,cache:'no-store',signal:AbortSignal.timeout(8000)});
 if(!response.ok){console.error(JSON.stringify({event:'database_request_failed',status:response.status}));throw new Error('DATABASE_UNAVAILABLE');}
 return response.json();
}
export async function readWorkspace(owner:string,fetcher:typeof fetch=fetch):Promise<StoredWorkspace|null>{
 const rows=await request(`claimwise_workspaces?owner=eq.${encodeURIComponent(owner)}&select=revision,data`,{},fetcher);
 if(!Array.isArray(rows)||rows.length>1)throw new Error('DATABASE_RESPONSE_INVALID');
 if(!rows.length)return null;
 const row=rows[0];
 if(!Number.isInteger(row.revision)||row.revision<1||!Array.isArray(row.data?.claims))throw new Error('DATABASE_RESPONSE_INVALID');
 return row;
}
export async function saveWorkspace(owner:string,revision:number,data:Workspace,fetcher:typeof fetch=fetch):Promise<boolean>{
 const result=await request('rpc/save_claimwise_workspace',{method:'POST',body:JSON.stringify({p_owner:owner,p_expected_revision:revision,p_data:data})},fetcher);
 if(typeof result!=='boolean')throw new Error('DATABASE_RESPONSE_INVALID');
 return result;
}
