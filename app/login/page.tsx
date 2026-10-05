export const dynamic='force-dynamic';
export default async function Login({searchParams}:{searchParams:Promise<{error?:string}>}){
 const {error}=await searchParams;
 return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24}}><section className="modal" style={{maxWidth:420}}><div className="eyebrow">CLAIMWISE · REVIEWER ACCESS</div><h1>Welcome to your review workspace.</h1><p className="muted" style={{marginTop:16}}>Sign in with the demo reviewer password supplied by the application owner.</p><form action="/api/login" method="post"><label>Reviewer password<input type="password" name="password" required autoComplete="current-password" autoFocus/></label>{error&&<p className="form-error" role="alert">Incorrect password. Please try again.</p>}<button className="primary full" style={{marginTop:22}}>Sign in</button></form><p className="micro">Demonstration workspace. Use sample expenses only.</p></section></main>;
}
