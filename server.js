'use strict';
const http = require('node:http');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const WebSocket = require('ws');
const PORT = Number(process.env.PORT || 8080);
const sessions = new Map();       // code -> pending session
const tokens = new Map();         // opaque token -> session
const clients = new Map();        // session -> Set<WebSocket>
const json = (res, status, data) => { res.writeHead(status, {'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin': process.env.ALLOWED_ORIGIN || '*','access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type'}); res.end(JSON.stringify(data)); };
const random = n => crypto.randomBytes(n).toString('base64url');
function cleanup(){ const now=Date.now(); for(const [code,s] of sessions) if(s.expires < now) sessions.delete(code); }
const server = http.createServer((req,res)=>{
  if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':process.env.ALLOWED_ORIGIN||'*','access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type'});return res.end();}
  const url = new URL(req.url,'http://localhost');
  if(req.method==='GET' && url.pathname==='/health') return json(res,200,{ok:true,service:'R3PRO Phone Link Relay',sessions:sessions.size});
  if(req.method!=='POST') return json(res,404,{error:'Not found'});
  let raw=''; req.on('data',c=>{raw+=c;if(raw.length>8192){res.destroy();}}); req.on('end',()=>{
    cleanup(); let body={}; try{body=JSON.parse(raw||'{}')}catch{return json(res,400,{error:'Invalid JSON'});}
    if(url.pathname==='/api/pair/create'){
      const code=String(crypto.randomInt(0,1000000)).padStart(6,'0');
      const token=random(32), session={code,expires:Date.now()+5*60*1000,paired:false,createdToken:token,labels:[]};
      sessions.set(code,session); tokens.set(token,session); clients.set(session,new Set());
      session.labels.push(String(body.label||'Device A').slice(0,60));
      return json(res,201,{code,token,expiresIn:300});
    }
    if(url.pathname==='/api/pair/join'){
      const code=String(body.code||''); const session=sessions.get(code);
      if(!session || session.expires<Date.now()) return json(res,410,{error:'Kode tidak valid atau sudah kedaluwarsa'});
      if(session.paired) return json(res,409,{error:'Kode sudah digunakan'});
      session.paired=true; session.expires=Date.now()+24*60*60*1000; session.labels.push(String(body.label||'Device B').slice(0,60));
      const token=random(32); tokens.set(token,session);
      const peers=clients.get(session)||new Set(); for(const ws of peers) if(ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify({type:'paired'}));
      return json(res,200,{token,paired:true});
    }
    return json(res,404,{error:'Unknown endpoint'});
  });
});
const wss = new WebSocket.Server({noServer:true,maxPayload:2048});
server.on('upgrade',(req,socket,head)=>{
  const url=new URL(req.url,'http://localhost'); const token=url.searchParams.get('token');
  const session=tokens.get(token);
  if(!session){socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');return socket.destroy();}
  wss.handleUpgrade(req,socket,head,ws=>{ws.r3session=session;wss.emit('connection',ws);});
});
wss.on('connection',ws=>{
  const session=ws.r3session; const peers=clients.get(session)||new Set(); peers.add(ws);clients.set(session,peers);
  ws.on('message',buf=>{
    let m;try{m=JSON.parse(buf.toString())}catch{return;}
    if(m.type!=='event' || !session.paired)return;
    const packet=JSON.stringify({type:'event',title:String(m.title||'Notifikasi').slice(0,100),body:String(m.body||'').slice(0,500),sentAt:Date.now()});
    for(const peer of peers) if(peer!==ws && peer.readyState===WebSocket.OPEN) peer.send(packet);
  });
  ws.on('close',()=>{peers.delete(ws);});
});
server.listen(PORT,'0.0.0.0',()=>console.log(`R3PRO relay listening on ${PORT}`));
