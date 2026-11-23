# -*- coding: utf-8 -*-
"""从非懒加载版 HTML 采集每页 fitBody 最终字号/间距，写入 JSON。
用法: python bake_fit_values.py <参考HTML> <输出JSON>
采集结果并入 data.json 的 meta.fitValues 字段，生成器据此固化版式。"""
import json,subprocess,time,urllib.request,websocket,io,sys,os
CHROME=r'C:/Program Files/Google/Chrome/Application/chrome.exe'
OLD=(sys.argv[1] if len(sys.argv)>1 else '')
OUT=(sys.argv[2] if len(sys.argv)>2 else 'fit_values.json')
PORT=9358
def gj(p):return json.loads(urllib.request.urlopen('http://127.0.0.1:%d%s'%(PORT,p),timeout=5).read())
class T:
 def __init__(s,u):s.w=websocket.create_connection(u,timeout=300,suppress_origin=True);s.i=0
 def send(s,m,p=None):
  s.i+=1;s.w.send(json.dumps({'id':s.i,'method':m,'params':p or {}}))
  while 1:
   x=json.loads(s.w.recv())
   if x.get('id')==s.i:return x.get('result',{})
 def ev(s,e):return s.send('Runtime.evaluate',{'expression':e,'returnByValue':True}).get('result',{}).get('value')
p=subprocess.Popen([CHROME,'--headless=new','--disable-gpu','--remote-debugging-port=%d'%PORT,'--user-data-dir='+os.path.join(os.environ.get('TEMP','/tmp'),'chrome_bake_fit'),'about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 for _ in range(80):
  try:gj('/json/version');break
  except:time.sleep(.25)
 time.sleep(1)
 t=T(next(x for x in gj('/json/list') if x['type']=='page')['webSocketDebuggerUrl'])
 t.send('Page.enable');t.send('Runtime.enable')
 t.send('Page.navigate',{'url':'file:///'+OLD.replace('\\','/')})
 for _ in range(600):
  if t.ev('document.readyState')=='complete':break
  time.sleep(.05)
 time.sleep(3)
 vals=t.ev('''(()=>{const o={};document.querySelectorAll('.slide-idea').forEach(s=>{
   const i=Array.prototype.indexOf.call(document.querySelectorAll('.slide'),s);
   const c=s.querySelector('.cols'); if(c)o[i]=[c.style.getPropertyValue('--body-fs'),c.style.getPropertyValue('--body-gap')];
 });return o;})()''')
 io.open(OUT,'w',encoding='utf-8').write(json.dumps(vals))
 print('采集页数:',len(vals),'样本:',{k:vals[k] for k in list(vals)[:3]})
finally:p.terminate()
