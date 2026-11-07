// Secret Hitler – Server ohne Abhängigkeiten. Start: node server.js
const http=require('http'),fs=require('fs'),os=require('os'),cr=require('crypto');
const PORT=process.env.PORT||3000;
const P={};let G,EV=0,LAST=null;
const shuf=a=>{for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
const reset=()=>{G={phase:'lobby',order:Object.keys(P),log:[],lib:0,fas:0,track:0,deck:[],disc:[],pres:null,chan:null,lastP:null,lastC:null,nom:null,votes:{},lv:null,hand:[],power:null,winner:null,why:'',priv:{},sp:null,idx:0,inv:[],veto:null};LAST=null;for(const p of Object.values(P)){p.role=null;p.alive=true}};
reset();
const log=m=>G.log.push(m),nm=i=>P[i].name,alive=()=>G.order.filter(i=>P[i].alive);
const draw=k=>{if(G.deck.length<k){G.deck=shuf(G.deck.concat(G.disc));G.disc=[]}return G.deck.splice(0,k)};
const win=(w,why)=>{G.phase='over';G.winner=w;G.why=why;log(why)};
const elig=()=>{const a=alive();return a.filter(i=>i!=G.pres&&i!=G.lastC&&(a.length<=5||i!=G.lastP))};
function start(){
  const n=G.order.length,f=[0,0,0,0,0,2,2,3,3,4,4][n];
  const roles=shuf(['H',...Array(f-1).fill('F'),...Array(n-f).fill('L')]);
  G.order.forEach((i,k)=>{P[i].role=roles[k];P[i].alive=true});
  G.deck=shuf(Array(6).fill('L').concat(Array(11).fill('F')));
  G.idx=Math.random()*n|0;G.pres=G.order[G.idx];G.phase='nominate';
  log('Spiel gestartet. Erster Präsident: '+nm(G.pres));
}
function adv(){
  G.hand=[];G.priv={};G.veto=null;G.power=null;G.nom=null;G.chan=null;
  if(G.sp){G.pres=G.sp;G.sp=null}
  else{let k=G.idx;do{k=(k+1)%G.order.length}while(!P[G.order[k]].alive);G.idx=k;G.pres=G.order[k]}
  G.phase='nominate';
}
function enact(c,chaos){
  c=='L'?G.lib++:G.fas++;G.track=0;EV++;LAST={c,chaos:!!chaos};
  log('Gesetz verabschiedet: '+(c=='L'?'Liberal':'Faschistisch')+(chaos?' (Chaos)':''));
  if(G.lib>=5)return win('L','5 liberale Gesetze – Liberale gewinnen!');
  if(G.fas>=6)return win('F','6 faschistische Gesetze – Faschisten gewinnen!');
  if(c=='F'&&!chaos){
    const n=G.order.length;
    const pw=(n<=6?[0,0,'peek','kill','kill']:n<=8?[0,'inv','sp','kill','kill']:['inv','inv','sp','kill','kill'])[G.fas-1];
    if(pw){
      G.phase='power';G.power=pw;
      if(pw=='peek'){
        if(G.deck.length<3){G.deck=shuf(G.deck.concat(G.disc));G.disc=[]}
        G.priv[G.pres]='Oberste 3 Karten: '+G.deck.slice(0,3).map(x=>x=='L'?'Liberal':'Faschistisch').join(', ');
        G.power='ack';
      }
      return;
    }
  }
  adv();
}
function fail(){
  G.track++;
  if(G.track>=3){log('Chaos! Das oberste Gesetz wird verabschiedet.');G.lastP=G.lastC=null;enact(draw(1)[0],true)}
  else adv();
}
function tally(){
  const v=Object.entries(G.votes),ja=v.filter(x=>x[1]).length,ok=ja*2>v.length;
  G.lv=v.map(([i,b])=>[nm(i),b]);
  log('Wahl: '+ja+' Ja / '+(v.length-ja)+' Nein – '+(ok?'angenommen':'abgelehnt'));
  if(ok){
    G.chan=G.nom;G.lastP=G.pres;G.lastC=G.chan;
    if(G.fas>=3&&P[G.chan].role=='H')return win('F','Hitler wurde zum Kanzler gewählt – Faschisten gewinnen!');
    G.hand=draw(3);G.phase='legP';
  }else fail();
}
function act(p,a){
  const id=p.id,ph=G.phase,x=a.x,bad='Ungültige Aktion';
  switch(a.t){
    case 'start':
      if(ph!='lobby'||G.order[0]!=id)return 'Nur der Host kann starten';
      if(G.order.length<5)return 'Mindestens 5 Spieler nötig';
      start();break;
    case 'nominate':
      if(ph!='nominate'||id!=G.pres||!elig().includes(x))return bad;
      G.nom=x;G.votes={};G.phase='vote';log(nm(id)+' nominiert '+nm(x)+' als Kanzler');break;
    case 'vote':
      if(ph!='vote'||!p.alive||id in G.votes)return bad;
      G.votes[id]=!!x;
      if(Object.keys(G.votes).length==alive().length)tally();break;
    case 'dp':
      if(ph!='legP'||id!=G.pres||!(x>=0&&x<3))return bad;
      G.disc.push(...G.hand.splice(x,1));G.phase='legC';break;
    case 'dc':
      if(ph!='legC'||id!=G.chan||G.veto=='asked'||!(x>=0&&x<2))return bad;
      G.disc.push(...G.hand.splice(x,1));enact(G.hand[0]);break;
    case 'veto':
      if(ph!='legC'||id!=G.chan||G.fas<5||G.veto)return bad;
      G.veto='asked';log(nm(id)+' schlägt ein Veto vor');break;
    case 'vr':
      if(ph!='legC'||id!=G.pres||G.veto!='asked')return bad;
      if(x){log('Veto angenommen – beide Gesetze verworfen');G.disc.push(...G.hand);G.veto=null;fail()}
      else{G.veto='no';log('Veto abgelehnt – der Kanzler muss ein Gesetz wählen')}
      break;
    case 'pw':{
      const t=P[x];
      if(ph!='power'||id!=G.pres||!t||!t.alive||x==id)return bad;
      if(G.power=='inv'){
        if(G.inv.includes(x))return 'Schon untersucht';
        G.inv.push(x);G.priv[id]=t.name+' ist '+(t.role=='L'?'LIBERAL':'FASCHIST');G.power='ack';
        log(nm(id)+' untersucht '+t.name);
      }else if(G.power=='kill'){
        t.alive=false;log(nm(id)+' erschießt '+t.name);
        if(t.role=='H')win('L','Hitler wurde erschossen – Liberale gewinnen!');else adv();
      }else if(G.power=='sp'){
        G.sp=x;log(nm(id)+' bestimmt '+t.name+' zum nächsten Präsidenten');adv();
      }else return bad;
      break}
    case 'kick':{
      if(ph!='lobby'||G.order[0]!=id||x==id||!G.order.includes(x))return bad;
      G.order=G.order.filter(i=>i!=x);if(P[x].res)P[x].res.end();delete P[x];break}
    // TESTMODUS-BEGIN
    case 'bot':case 'fill':{
      if(ph!='lobby'||G.order[0]!=id)return bad;
      const N=['Alex','Bea','Carl','Dana','Emil','Fay','Gero','Hana','Ivo','Jule'];
      let add=a.t=='bot'?1:Math.max(0,7-G.order.length);
      while(add-->0&&G.order.length<10){
        const name=N.find(n=>!G.order.some(i=>P[i].name==n));const b='b'+cr.randomBytes(5).toString('hex');
        P[b]={id:b,name,bot:true,role:null,alive:true,res:null};G.order.push(b);
      }
      break}
    // TESTMODUS-END
    case 'ok':if(ph=='power'&&G.power=='ack'&&id==G.pres)adv();break;
    case 'new':if(ph!='lobby'&&G.order[0]==id){reset();}break;
    default:return bad;
  }
}
function view(id){
  const me=P[id],n=G.order.length,ph=G.phase,over=ph=='over';
  return{phase:ph,lib:G.lib,fas:G.fas,track:G.track,
    me:{id,name:me.name,role:me.role,alive:me.alive,host:G.order[0]==id},
    pl:G.order.map(i=>{const q=P[i];return{id:i,name:q.name,alive:q.alive,on:!!q.res||!!q.bot,bot:!!q.bot,
      role:(over||i==id||(me.role=='F'&&q.role!='L'))?q.role:null}}),
    ev:EV,last:LAST,pres:G.pres,chan:G.chan,nom:G.nom,voted:Object.keys(G.votes),lv:G.lv,
    hand:(ph=='legP'&&id==G.pres)||(ph=='legC'&&id==G.chan)?G.hand:null,
    elig:ph=='nominate'?elig():null,power:G.power,veto:G.veto,fas5:G.fas>=5,inv:G.inv,priv:G.priv[id]||null,
    winner:G.winner,why:G.why,log:G.log.slice(-10).reverse()};
}
// TESTMODUS-BEGIN
let bt=null;const sched=()=>{if(bt)return;bt=setTimeout(()=>{bt=null;if(botStep())bc()},1300)};
function botStep(){
  const ph=G.phase,B=i=>i&&P[i]&&P[i].bot,pick=a=>a[Math.random()*a.length|0];
  const dis=i=>{const k=G.hand.indexOf(P[i].role=='L'?'F':'L');return k<0?0:k};
  const go=(i,o)=>!act(P[i],o);
  if(ph=='nominate'&&B(G.pres))return go(G.pres,{t:'nominate',x:pick(elig())});
  if(ph=='vote'){const b=alive().find(i=>B(i)&&!(i in G.votes));if(b)return go(b,{t:'vote',x:Math.random()<.65})}
  if(ph=='legP'&&B(G.pres))return go(G.pres,{t:'dp',x:dis(G.pres)});
  if(ph=='legC'){
    if(G.veto=='asked'&&B(G.pres))return go(G.pres,{t:'vr',x:false});
    if(G.veto!='asked'&&B(G.chan))return go(G.chan,{t:'dc',x:dis(G.chan)});
  }
  if(ph=='power'&&B(G.pres)){
    if(G.power=='ack')return go(G.pres,{t:'ok'});
    const t=alive().filter(i=>i!=G.pres&&!(G.power=='inv'&&G.inv.includes(i)));
    return go(G.pres,{t:'pw',x:pick(t)});
  }
  return false;
}
// TESTMODUS-END
const bc=()=>{for(const p of Object.values(P))if(p.res)p.res.write('data: '+JSON.stringify(view(p.id))+'\n\n');sched()};
setInterval(()=>{for(const p of Object.values(P))if(p.res)p.res.write(':\n\n')},20000);
http.createServer((q,r)=>{
  const u=new URL(q.url,'http://x');
  if(u.pathname=='/events'){
    const p=P[u.searchParams.get('id')];
    if(!p){r.writeHead(404);return r.end()}
    r.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});
    p.res=r;r.write('retry: 2000\n\n');
    q.on('close',()=>{if(p.res===r){p.res=null;bc()}});
    bc();return;
  }
  if(u.pathname=='/api'&&q.method=='POST'){
    let b='';q.on('data',c=>b+=c);
    q.on('end',()=>{
      let a,out={};
      try{a=JSON.parse(b)}catch{a={}}
      if(a.t=='join'){
        const name=String(a.name||'').trim().slice(0,14);
        if(G.phase!='lobby')out.err='Das Spiel läuft bereits';
        else if(G.order.length>=10)out.err='Lobby voll (max. 10 Spieler)';
        else if(!name)out.err='Bitte Namen eingeben';
        else if(G.order.some(i=>P[i].name.toLowerCase()==name.toLowerCase()))out.err='Name schon vergeben';
        else{const id='p'+cr.randomBytes(6).toString('hex');P[id]={id,name,role:null,alive:true,res:null};G.order.push(id);out.id=id;bc()}
      }else{
        const p=P[a.id];
        if(!p)out.err='Unbekannter Spieler – Seite neu laden';
        else{const e=act(p,a);if(e)out.err=e;bc()}
      }
      r.writeHead(200,{'Content-Type':'application/json'});r.end(JSON.stringify(out));
    });return;
  }
  r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
  r.end(fs.readFileSync(__dirname+'/index.html'));
}).listen(PORT,'0.0.0.0',()=>{
  console.log('Secret Hitler läuft. Mitspieler öffnen im selben WLAN:');
  for(const l of Object.values(os.networkInterfaces()))for(const i of l)if(i.family=='IPv4'&&!i.internal)console.log('  http://'+i.address+':'+PORT);
});
