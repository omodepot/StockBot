/* StockBot voice v20 — isolated from camera; explicit user-gesture speech capture */
(()=>{
  let active=false,recognizer=null;
  const $=id=>document.getElementById(id);
  const say=s=>{try{toast(s)}catch(_){}};
  function parse(text){
    const low=String(text||'').toLowerCase().trim();
    const words={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20};
    let q=(low.match(/(?:quantity|qty|received|receive|count)\s*(?:is|of|=|:)?\s*(\d+)/i)||[])[1];
    if(!q){const m=low.match(/(?:quantity|qty|received|receive|count)\s+(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/i);if(m)q=String(words[m[1]])}
    const received=$('received');if(q!=null&&received){received.value=q;received.dispatchEvent(new Event('input',{bubbles:true}));received.dispatchEvent(new Event('change',{bubbles:true}))}
    let c='';
    if(/like\s*new|open\s*box/.test(low))c='Like New/Open Box';
    else if(/new\s*sealed|new\/sealed|brand\s*new|\bsealed\b|\bnew\b/.test(low))c='New/Sealed';
    else if(/missing\s*parts|\bmissing\b/.test(low))c='Missing Parts';
    else if(/fair|damaged|broken/.test(low))c='Fair/Damaged';
    else if(/\bgood\b/.test(low))c='Good';
    if(c){window.condition=c;document.querySelectorAll('#conditions button').forEach(b=>b.classList.toggle('sel',b.dataset.c===c));}
    const notes=$('notes');if(notes){const cleaned=low.replace(/(?:quantity|qty|received|receive|count)\s*(?:is|of|=|:)?\s*(?:\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)/ig,'').replace(/(?:condition\s*)?(?:like\s*new|open\s*box|new\s*sealed|brand\s*new|sealed|new|missing\s*parts|missing|fair|damaged|broken|good)/ig,'').replace(/^[\s,.-]+|[\s,.-]+$/g,'');if(cleaned)notes.value+=(notes.value?'\n':'')+cleaned;}
    say('Heard: '+text);setTimeout(()=>say('Applied'+(q!=null?' · quantity '+q:'')+(c?' · '+c:'')),900);
    return {quantity:q,condition:c,text};
  }
  function buttonLabel(s){const b=$('speakNotes');if(b)b.textContent=s}
  function start(){
    if(active)return;
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){say('Speech recognition is not available in this browser. Open StockBot in Safari on iPhone.');return}
    try{
      recognizer=new SR();recognizer.lang='en-US';recognizer.continuous=false;recognizer.interimResults=false;recognizer.maxAlternatives=3;
      recognizer.onstart=()=>{active=true;buttonLabel('🎙 Listening…');say('Listening — say “quantity 3, condition good”')};
      recognizer.onresult=e=>{let text='';for(let i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal)text+=(text?' ':'')+e.results[i][0].transcript}if(text)parse(text)};
      recognizer.onerror=e=>{active=false;buttonLabel('🎙 Speak Item Info');say('Voice error: '+(e.error||'unknown'))};
      recognizer.onend=()=>{active=false;buttonLabel('🎙 Speak Item Info')};
      recognizer.start();
    }catch(e){active=false;buttonLabel('🎙 Speak Item Info');say('Voice error: '+(e.message||e))}
  }
  function stop(){try{recognizer?.stop()}catch(_){}active=false;buttonLabel('🎙 Speak Item Info')}
  document.addEventListener('click',e=>{const b=e.target.closest?.('#speakNotes,#voiceQty,#speakQty2');if(!b)return;e.preventDefault();e.stopPropagation();active?stop():start()},true);
  window.StockBotVoice={start,stop,parse};
})();