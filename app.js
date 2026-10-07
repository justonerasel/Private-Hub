const CFG = window.SUPABASE_CONFIG || {};
const sb = window.supabase.createClient(CFG.SUPABASE_URL || "", CFG.SUPABASE_ANON_KEY || "");
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const els = {
  gate: $("#gate"), adminGate: $("#adminGate"), app: $("#app"), admin: $("#admin"),
  visitorForm: $("#visitorForm"), visitorCode: $("#visitorCode"), visitorMsg: $("#visitorMsg"),
  adminForm: $("#adminForm"), adminEmail: $("#adminEmail"), adminPassword: $("#adminPassword"), adminMsg: $("#adminMsg"),
  statusText: $("#statusText"), adminBtn: $("#adminBtn"), logoutBtn: $("#logoutBtn"), adminExit: $("#adminExit"),
  library: $("#library"), stats: $("#stats"), adminContent: $("#adminContent"), codes: $("#codes"),
  uploadForm: $("#uploadForm"), uploadCategory: $("#uploadCategory"), uploadTitle: $("#uploadTitle"), uploadFile: $("#uploadFile"), uploadMsg: $("#uploadMsg"),
  codeForm: $("#codeForm"), newCode: $("#newCode"), codeLabel: $("#codeLabel"), codeExpiry: $("#codeExpiry"), codeMaxUses: $("#codeMaxUses"), codeMsg: $("#codeMsg")
};

function configured(){ return !!CFG.SUPABASE_URL && !!CFG.SUPABASE_ANON_KEY; }
function msg(el,text,good=false){el.textContent=text;el.style.color=good?"#8fffd1":"#ffb3b8";}
function show(section){[els.gate,els.adminGate,els.app,els.admin].forEach(x=>x.classList.add("hidden"));section.classList.remove("hidden");}
function fmtSize(n){if(!n)return "0 B";const u=["B","KB","MB","GB"];let i=0,v=n;while(v>=1024&&i<3){v/=1024;i++}return `${v.toFixed(i?1:0)} ${u[i]}`;}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function mimeFor(cat){return ({image:"image/*",video:"video/*",audio:"audio/*",document:".pdf,.doc,.docx,.xls,.xlsx,.txt,.zip",apk:".apk"})[cat]||"*/*";}

async function ensureAnonymous(){
  const {data:{session}}=await sb.auth.getSession();
  if(session) return session;
  const {data,error}=await sb.auth.signInAnonymously();
  if(error) throw error;
  return data.session;
}
async function isAdmin(){
  const {data,error}=await sb.rpc("is_admin");
  return !error && data === true;
}
async function hasAccess(){
  const {data,error}=await sb.rpc("has_visitor_access");
  return !error && data === true;
}

async function boot(){
  if(!configured()){
    msg(els.visitorMsg,"Setup required: open config.js and add your Supabase URL + publishable/anon key.");
    els.visitorForm.querySelector("button").disabled=true;
    return;
  }
  try{
    const {data:{session}}=await sb.auth.getSession();
    els.statusText.textContent=session?"ONLINE":"READY";
    if(session && await isAdmin()){showAdminControls(); await openAdmin();}
    else if(session && await hasAccess()){await openApp(false);}
  }catch(e){console.error(e)}
}
function showAdminControls(){els.adminBtn.classList.remove("hidden");}

els.visitorForm.addEventListener("submit",async e=>{
  e.preventDefault(); msg(els.visitorMsg,"Checking access…");
  try{
    await ensureAnonymous();
    const {data,error}=await sb.rpc("verify_visitor_code",{input_code:els.visitorCode.value.trim()});
    if(error) throw error;
    if(!data?.ok) throw new Error(data?.message||"Access denied");
    msg(els.visitorMsg,"Access granted.",true); await openApp(false);
  }catch(err){msg(els.visitorMsg,err.message)}
});

$("#showAdmin").addEventListener("click",()=>show(els.adminGate));
$$("[data-back]").forEach(b=>b.addEventListener("click",()=>show(els.gate)));

els.adminForm.addEventListener("submit",async e=>{
  e.preventDefault(); msg(els.adminMsg,"Signing in…");
  try{
    const {error}=await sb.auth.signInWithPassword({email:els.adminEmail.value.trim(),password:els.adminPassword.value});
    if(error) throw error;
    if(!(await isAdmin())) throw new Error("This account is not marked as an admin.");
    showAdminControls(); await openAdmin();
  }catch(err){msg(els.adminMsg,err.message)}
});

els.adminBtn.addEventListener("click",openAdmin);
els.adminExit.addEventListener("click",()=>openApp(false));
els.logoutBtn.addEventListener("click",async()=>{await sb.auth.signOut();location.reload()});

async function openApp(admin=false){
  show(els.app); els.statusText.textContent="SECURE";
  if(await isAdmin()) showAdminControls();
  await loadLibrary();
}
async function openAdmin(){
  if(!(await isAdmin())) return show(els.gate);
  show(els.admin); els.statusText.textContent="ADMIN";
  await Promise.all([loadAdminContent(),loadCodes()]);
}

async function getUrl(path,download=false){
  const {data,error}=await sb.storage.from("media").createSignedUrl(path,300,{download});
  if(error) throw error; return data.signedUrl;
}
function card(c,url){
  let media="";
  if(c.category==="image") media=`<img src="${url}" alt="${esc(c.title)}" loading="lazy">`;
  else if(c.category==="video") media=`<video src="${url}" controls preload="metadata"></video>`;
  else if(c.category==="audio") media=`<div class="audio"><div style="font-size:48px">🎵</div><audio src="${url}" controls></audio></div>`;
  else media=`<div style="font-size:55px">${c.category==="apk"?"📱":"📄"}</div>`;
  return `<article class="card"><div class="thumb">${media}</div><div class="cardBody"><span class="tag">${esc(c.category)}</span><h3>${esc(c.title)}</h3><div class="meta">${esc(c.original_name)} • ${fmtSize(c.size_bytes)}</div><div class="cardActions"><button data-open="${esc(url)}">${c.category==="video"||c.category==="image"?"OPEN":"DOWNLOAD"}</button></div></div></article>`;
}
async function loadLibrary(){
  const {data,error}=await sb.from("content").select("*").order("created_at",{ascending:false});
  if(error){els.library.innerHTML=`<div class="glass panel">${esc(error.message)}</div>`;return}
  const counts={image:0,video:0,audio:0,document:0,apk:0};data.forEach(x=>counts[x.category]++);
  els.stats.innerHTML=Object.entries(counts).map(([k,v])=>`<div class="stat"><b>${v}</b><small>${k.toUpperCase()}</small></div>`).join("");
  const rendered=[];
  for(const c of data){try{const u=await getUrl(c.storage_path,c.category==="apk"||c.category==="document");rendered.push(card(c,u))}catch{}}
  els.library.innerHTML=rendered.join("")||`<div class="glass panel">No content has been uploaded yet.</div>`;
  $$("[data-open]").forEach(b=>b.addEventListener("click",()=>window.open(b.dataset.open,"_blank","noopener")));
}

els.uploadForm.addEventListener("submit",async e=>{
  e.preventDefault();msg(els.uploadMsg,"Uploading…");
  try{
    if(!(await isAdmin())) throw new Error("Admin only");
    const file=els.uploadFile.files[0]; if(!file) throw new Error("Choose a file.");
    const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
    const path=`${els.uploadCategory.value}/${crypto.randomUUID()}-${safe}`;
    const {error:upErr}=await sb.storage.from("media").upload(path,file,{contentType:file.type||"application/octet-stream",upsert:false});
    if(upErr) throw upErr;
    const {data:{user}}=await sb.auth.getUser();
    const {error:dbErr}=await sb.from("content").insert({title:els.uploadTitle.value.trim(),category:els.uploadCategory.value,storage_path:path,original_name:file.name,mime_type:file.type,size_bytes:file.size,created_by:user.id});
    if(dbErr){await sb.storage.from("media").remove([path]);throw dbErr}
    msg(els.uploadMsg,"Uploaded successfully.",true);els.uploadForm.reset();await loadAdminContent();
  }catch(err){msg(els.uploadMsg,err.message)}
});

async function loadAdminContent(){
  const {data,error}=await sb.from("content").select("*").order("created_at",{ascending:false});
  if(error){els.adminContent.textContent=error.message;return}
  els.adminContent.innerHTML=data.map(c=>`<div class="adminFile"><div><b>${esc(c.title)}</b><small>${esc(c.category)} • ${fmtSize(c.size_bytes)}</small></div><button class="danger" data-delete="${c.id}" data-path="${esc(c.storage_path)}">DELETE</button></div>`).join("")||"<small>No files.</small>";
  $$("#adminContent [data-delete]").forEach(b=>b.addEventListener("click",async()=>{
    if(!confirm("Delete this file?"))return;
    const {error:se}=await sb.storage.from("media").remove([b.dataset.path]);if(se)return alert(se.message);
    const {error:de}=await sb.from("content").delete().eq("id",b.dataset.delete);if(de)return alert(de.message);
    await loadAdminContent();
  }));
}

els.codeForm.addEventListener("submit",async e=>{
  e.preventDefault();msg(els.codeMsg,"Creating…");
  try{
    const exp=els.codeExpiry.value?new Date(els.codeExpiry.value).toISOString():null;
    const max=els.codeMaxUses.value?Number(els.codeMaxUses.value):null;
    const {error}=await sb.rpc("create_visitor_code",{input_code:els.newCode.value.trim(),input_label:els.codeLabel.value.trim()||"Visitor",input_expires_at:exp,input_max_uses:max});
    if(error)throw error;msg(els.codeMsg,"Code created. Store it safely.",true);els.codeForm.reset();await loadCodes();
  }catch(err){msg(els.codeMsg,err.message)}
});
async function loadCodes(){
  const {data,error}=await sb.from("visitor_codes").select("id,label,active,expires_at,max_uses,use_count,created_at").order("created_at",{ascending:false});
  if(error){els.codes.textContent=error.message;return}
  els.codes.innerHTML=data.map(c=>`<div class="codeRow"><div><b>${esc(c.label)}</b><small>${c.active?"ACTIVE":"OFF"} • uses ${c.use_count}${c.max_uses?"/"+c.max_uses:""}${c.expires_at?" • expires "+new Date(c.expires_at).toLocaleString():""}</small></div><button data-toggle="${c.id}" data-state="${!c.active}">${c.active?"DISABLE":"ENABLE"}</button></div>`).join("")||"<small>No codes yet.</small>";
  $$("#codes [data-toggle]").forEach(b=>b.addEventListener("click",async()=>{const {error}=await sb.rpc("toggle_visitor_code",{input_id:Number(b.dataset.toggle),input_active:b.dataset.state==="true"});if(error)alert(error.message);else loadCodes()}));
}

document.addEventListener("pointermove",e=>{const g=$("#cursorGlow");if(g){g.style.left=e.clientX+"px";g.style.top=e.clientY+"px"}});
document.addEventListener("pointerdown",e=>{const r=document.createElement("div");r.className="ripple";r.style.left=e.clientX+"px";r.style.top=e.clientY+"px";document.body.appendChild(r);setTimeout(()=>r.remove(),800)});
boot();
