/* StockBot iPhone live scanner v12 — Quagga2 camera pipeline */
(()=>{
  const BUILD='2026-09-24-ios-live-v12';
  let active=false,target='lookup',quaggaLoaded=false;
  const $id=id=>document.getElementById(id);
  const valid=c=>{c=String(c||'').replace(/\D/g,'');return [8,12,13,14].includes(c.length)?c:''};
  async function loadQuagga(){
    if(window.Quagga){quaggaLoaded=true;return}
    await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@ericblade/quagga2@1.8.4/dist/quagga.min.js';s.onload=resolve;s.onerror=()=>reject(new Error('Scanner engine could not load'));document.head.appendChild(s)});
    quaggaLoaded=!!window.Quagga;if(!quaggaLoaded)throw new Error('Scanner engine unavailable');
  }
  async function stop(){
    active=false;
    try{window.Quagga?.offDetected(onDetected)}catch(_){}
    try{window.Quagga?.stop()}catch(_){}
    document.querySelectorAll('#scanVideo video').forEach(v=>{try{v.srcObject?.getTracks?.().forEach(t=>t.stop())}catch(_){}});
    $id('scanModal')?.classList.add('hidden');
  }
  async function onDetected(data){
    if(!active)return;
    const code=valid(data?.codeResult?.code);if(!code)return;
    active=false;if(navigator.vibrate)navigator.vibrate(80);
    await stop();
    try{await handleScannedUPC(code,target)}catch(e){console.error(e)}
  }
  async function start(nextTarget='lookup'){
    target=nextTarget;window.scanTarget=target;
    const modal=$id('scanModal'),box=$id('scanVideo'),status=$id('scanStatus');
    if(!modal||!box)return;
    modal.classList.remove('hidden');
    if(status)status.textContent='Opening rear camera…';
    const old=$id('scanPreview');if(old)old.style.display='none';
    document.querySelectorAll('#scanVideo video, #scanVideo canvas').forEach(n=>{if(n.id!=='scanPreview')n.remove()});
    try{
      await loadQuagga();
      await new Promise((resolve,reject)=>{
        Quagga.init({
          inputStream:{name:'Live',type:'LiveStream',target:box,constraints:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080},aspectRatio:{ideal:1.7777778}},area:{top:'18%',right:'4%',left:'4%',bottom:'18%'}},
          locator:{patchSize:'medium',halfSample:true},
          numOfWorkers:navigator.hardwareConcurrency?Math.min(4,navigator.hardwareConcurrency):2,
          frequency:12,
          decoder:{readers:['upc_reader','upc_e_reader','ean_reader','ean_8_reader']},
          locate:true
        },err=>err?reject(err):resolve());
      });
      active=true;Quagga.offDetected(onDetected);Quagga.onDetected(onDetected);Quagga.start();
      const v=box.querySelector('video');if(v){v.setAttribute('playsinline','');v.setAttribute('webkit-playsinline','');v.muted=true;try{await v.play()}catch(_){}}
      if(status)status.textContent='Camera ready — center the barcode in the green box';
    }catch(err){console.error('StockBot scanner v12',err);if(status)status.textContent='Camera error: '+(err?.message||err);if(typeof toast==='function')toast('Camera error: '+(err?.message||err));}
  }
  function wire(){
    const b=$id('scanBtn');if(b)b.onclick=()=>start('lookup');
    const c=$id('closeScan');if(c)c.onclick=stop;
    const fallback=$id('photoFallback');if(fallback){fallback.style.display='none'}
    const status=$id('scanStatus');if(status&&status.textContent.includes('Starting'))status.textContent='Ready to open rear camera';
    document.querySelectorAll('#scanNewUPC').forEach(b=>b.onclick=()=>start('editor'));
  }
  const obs=new MutationObserver(wire);obs.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
  window.StockBotScannerV12={start,stop,build:BUILD};
})();