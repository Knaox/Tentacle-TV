#!/usr/bin/env node
// Entrée sur la VRAIE page de connexion du banc (Tentacle 1.42.0, 127.0.0.1:3471) : les champs
// sont remplis par la page (setter natif + évènement input, comme une saisie), puis Entrée est
// une vraie touche native. Réussi = la page quitte /login. Compte de TEST du banc
// (~/.cache/tentacle-cef/banc/comptes.json), jamais affiché.
// Usage : node tests/saisie/connexion.mjs <port> [compte=user]
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { connect, sleep, K, keyboard } from './lib.mjs';

const [port = '9314', who = 'user'] = process.argv.slice(2);
const cache = process.env.TENTACLE_CEF_CACHE || `${homedir()}/.cache/tentacle-cef`;
const acct = JSON.parse(readFileSync(`${cache}/banc/comptes.json`, 'utf8'))[who];
const cdp = await connect(port);
const { js } = cdp;
const { press } = keyboard(js);
const href = () => js('location.pathname');

if (!(await href()).startsWith('/login')) {
  console.log(`OK  déjà connecté (${await href()}) — rien à prouver sur ce profil`);
  process.exit(0);
}
const fill = (sel, v) => `(()=>{const e=document.querySelector(${JSON.stringify(sel)});` +
  `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(v)});` +
  `e.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`;
await js(`window.__kk=[];for(const t of ['keydown','keypress','keyup'])document.addEventListener(t,e=>__kk.push(t+':'+e.key+':'+e.keyCode),true);1`);
await js(fill('input[name=username],#username', acct.name));
await js(fill('input[name=password],#password', acct.password));
await js(`document.querySelector('input[name=password],#password').focus();1`);
await press(K.return);
let path = '';
for (let i = 0; i < 50; i++) { path = await href().catch(() => ''); if (path && !path.startsWith('/login')) break; await sleep(200); }
const keys = await js('(window.__kk||[]).join(" | ")').catch(() => '(page changée)');
const ok = path && !path.startsWith('/login');
console.log(`${ok ? 'OK ' : 'ÉCHEC'} Entrée valide la connexion — page ${path || '?'} ; touches : ${keys}`);
cdp.close();
process.exit(ok ? 0 : 1);
