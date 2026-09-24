/* StockBot voice v22 — voice-only fix. Scanner/camera code is intentionally untouched. */
(()=>{'use strict';
let recording=false,rec=null,stream=null,chunks=[],timer=null;
const $=id=>document.getElementById(id), say=s=>{try{toast(s)}catch(_){}};
function setStatus(s){let st=$('voiceStatusV22');if(st)st.textContent=s;}
function apply(data){
 const q=data?.quantity,c=data?.condition,text=data?.text||'';
 const r=$('received');if(q!=null&&r){r.value=String(q);r.dispatchEvent(new Event('input',{bubbles:true}));r.dispatchEvent(new Event('change',{bubbles:true}))}
 if(c){window.condition=c;try{condition=c}catch(_){}document.querySelectorAll('#conditions button').forEach(b=>b.classList.toggle('sel',b.dataset.c===c))}
 setStatus('Heard: “'+text+'”'+(q!=null?' · quantity '+q:'')+(c?' · '+c:''));
 say('Applied'+(q!=null?' · quantity '+q:'')+(c?' · '+c:''));
}
function stopTracks(){try{stream?.getTracks().forEach(t=>t.stop())}catch(_){}stream=null}
async function transcribe(blob){
 const session=(await sb.auth.getSession()).data.session;if(!session?.access_token)throw new Error('Please sign in again');
 const fd=new FormData();fd.append('audio',blob,(blob.type||'').includes('mp4')?'stockbot.m4a':'stockbot.webm');
 const res=await fetch('https://aiwdfltusdzhrrbblvfi.supabase.co/functions/v1/stockbot-transcribe',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,apikey:'sb_publishable_0EdIThYXzFSZq98Njg_-dg_w8G_DAtf'},body:fd});
 const raw=await res.text();let d={};try{d=JSON.parse(raw)}catch(_){d={error:raw}}
 if(!res.ok)throw new Error(d.error||('Transcription failed ('+res.status+')'));return d;
}
async function finish(){if(!recording)return;recording=false;clearTimeout(timer);setStatus('Processing voice…');const b=$('speakNotes');if(b)b.textContent='Processing…';try{if(rec&&rec.state!=='inactive')rec.stop()}catch(e){stopTracks();setStatus('Voice error: '+e.message)}}
async function start(){
 if(recording)return;
 try{
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw new Error('Microphone recording is unavailable in this browser');
  setStatus('Requesting microphone…');
  stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});chunks=[];
  let mime='';for(const t of ['audio/mp4','audio/webm;codecs=opus','audio/webm']){if(MediaRecorder.isTypeSupported?.(t)){mime=t;break}}
  rec=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);
  rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
  rec.onerror=e=>{recording=false;stopTracks();setStatus('Microphone error: '+(e.error?.message||'recording failed'));say('Microphone error')};
  rec.onstop=async()=>{stopTracks();try{const blob=new Blob(chunks,{type:rec.mimeType||mime||'audio/webm'});if(blob.size<300)throw new Error('No voice audio was captured');const d=await transcribe(blob);apply(d)}catch(e){console.error('StockBot voice',e);setStatus('Voice error: '+(e.message||e));say('Voice error: '+(e.message||e))}finally{recording=false;const b=$('speakNotes');if(b)b.textContent='🎙 Speak Item Info'}};
  rec.start();recording=true;const b=$('speakNotes');if(b)b.textContent='⏹ Stop Listening';setStatus('🎙 Listening — say “quantity 3, condition good”');say('Listening…');timer=setTimeout(finish,5000);
 }catch(e){recording=false;stopTracks();setStatus('Voice error: '+(e.message||e));say('Voice error: '+(e.message||e))}
}
function install(){
 const editor=$('product')?.classList.contains('editorOpen');if(!editor)return;
 // Remove both legacy quantity buttons. One unified voice button handles quantity + condition + notes.
 ['voiceQty','speakQty2'].forEach(id=>$(id)?.remove());
 document.querySelectorAll('p.muted').forEach(p=>{if(p.textContent.includes('quantity 72 confirmed'))p.textContent='Tap Speak Item Info and say “quantity 3, condition good.” StockBot will fill both automatically.'});
 const b=$('speakNotes');if(!b)return;b.textContent=recording?'⏹ Stop Listening':'🎙 Speak Item Info';b.style.width='100%';b.onclick=e=>{e.preventDefault();e.stopPropagation();recording?finish():start()};
 if(!$('voiceStatusV22')){const d=document.createElement('div');d.id='voiceStatusV22';d.className='muted';d.style='margin:8px 0';d.textContent='Voice ready';b.parentElement?.insertAdjacentElement('afterend',d)}
}
new MutationObserver(()=>install()).observe(document.body,{childList:true,subtree:true});install();
window.StockBotVoiceV22={start,finish,apply};
})();