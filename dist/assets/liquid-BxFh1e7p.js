import{t as e}from"./main-D0s1Pwsm.js";var t=10,n=2.4,r=.75,i=`attribute vec2 aP; varying vec2 vUv; void main(){ vUv=aP*.5+.5; gl_Position=vec4(aP,0.,1.); }`,a=`
precision highp float;
varying vec2 vUv;
uniform vec2 uRes; uniform float uTime; uniform vec4 uB[${t}];
uniform sampler2D uA; uniform sampler2D uBt; uniform float uMix;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float map(vec3 p){
  float d=1e3;
  for(int i=0;i<${t};i++){ vec4 b=uB[i]; d=smin(d,length(p-b.xyz)-b.w,.62); }
  d+=sin(p.x*5.+uTime*1.3)*sin(p.y*4.+uTime)*sin(p.z*5.+uTime*.7)*.022;
  return d;
}
vec3 nrm(vec3 p){const vec2 e=vec2(.0025,-.0025);
  return normalize(e.xyy*map(p+e.xyy)+e.yyx*map(p+e.yyx)+e.yxy*map(p+e.yxy)+e.xxx*map(p+e.xxx));}
float tmask(vec2 uv){
  float n=vnoise(uv*vec2(uRes.x/uRes.y,1.)*3.2)*.72+vnoise(uv*18.)*.28;
  return smoothstep(n-.07,n+.07,uMix*1.22-.11);
}
vec3 poster(vec2 uv){
  if(uMix<=0.) return texture2D(uA,uv).rgb; // вне перехода маска = 0 и подтёки = 0
  float melt=sin(uMix*3.14159);
  float drip=(vnoise(vec2(uv.x*9.,2.))-.2)*.07*melt;
  vec3 a=texture2D(uA,uv+vec2(0.,drip)).rgb;
  vec3 b=texture2D(uBt,uv-vec2(0.,drip*.6)).rgb;
  return mix(a,b,tmask(uv));
}
// преломление с хроматикой: три канала со сдвигом r, 1.05r, 1.1r. Маска перехода и подтёк
// считаются один раз на средней точке (раньше — трижды): во время перехода это главная экономия
vec3 poster3(vec2 uv,vec2 r){
  vec2 u0=uv-r, u1=uv-r*1.05, u2=uv-r*1.1;
  if(uMix<=0.) return vec3(texture2D(uA,u0).r,texture2D(uA,u1).g,texture2D(uA,u2).b);
  float melt=sin(uMix*3.14159);
  float drip=(vnoise(vec2(u1.x*9.,2.))-.2)*.07*melt;
  vec2 da=vec2(0.,drip), db=vec2(0.,drip*.6);
  vec3 a=vec3(texture2D(uA,u0+da).r,texture2D(uA,u1+da).g,texture2D(uA,u2+da).b);
  vec3 b=vec3(texture2D(uBt,u0-db).r,texture2D(uBt,u1-db).g,texture2D(uBt,u2-db).b);
  return mix(a,b,tmask(u1));
}
vec3 pal(float t){return .5+.5*cos(6.2831*(t+vec3(0.,.33,.67)));}
vec3 env(vec3 d){
  vec3 c=vec3(.012);
  c+=vec3(1.)*smoothstep(.5,.92,d.y)*1.25;
  c+=vec3(.85,.93,1.)*smoothstep(.72,.98,d.x)*.9;
  c+=vec3(1.,.86,.8)*smoothstep(.78,.99,-d.x)*.45;
  c+=vec3(.6,.7,.9)*smoothstep(.6,.95,-d.y)*.12;
  c+=pal(d.y*.7+d.x*.35+uTime*.03)*.2*(1.-abs(d.y));
  return c;
}
void main(){
  vec2 fc=vUv*uRes; vec2 p=(fc-.5*uRes)/uRes.y;
  vec3 ro=vec3(0.,0.,6.), rd=normalize(vec3(p*.8,-1.));
  // ограничивающие сферы: где луч их не задевает, поле > .4 — ни капли, ни тени
  float t0=1e3, t1=-1.;
  for(int i=0;i<${t};i++){ vec4 b=uB[i]; vec3 oc=ro-b.xyz; float R=b.w+${r.toFixed(2)};
    float bb=dot(oc,rd), h=bb*bb-dot(oc,oc)+R*R;
    if(h>0.){ h=sqrt(h); t0=min(t0,-bb-h); t1=max(t1,-bb+h); } }
  vec3 col=poster(vUv);
  if(t1>0.){
    float t=max(t0,0.), md=1e3; bool hit=false; t1=min(t1,9.);
    for(int i=0;i<70;i++){ vec3 q=ro+rd*t; float d=map(q); md=min(md,d); if(d<.0015){hit=true;break;} t+=d*.95; if(t>t1)break; }
    col*=.5+.5*smoothstep(0.,.4,md);
    if(hit){
      vec3 q=ro+rd*t; vec3 n=nrm(q);
      float fr=pow(1.-max(dot(-rd,n),0.),2.4);
      vec2 r=n.xy*(.09+.07*(1.-fr));
      vec3 refr=poster3(vUv,r);
      vec3 R=reflect(rd,n);
      col=refr*(.8-fr*.5)+env(R)*(.5+fr*1.1);
      col+=pal(fr*1.3+n.y*.35+uTime*.04)*fr*.5;
      col+=pow(max(dot(R,normalize(vec3(.35,.8,.55))),0.),70.)*1.4;
    }
  }
  col*=1.-.38*length(vUv-.5);
  col+=(hash(fc+fract(uTime))-.5)*.03;
  gl_FragColor=vec4(col,1.);
}`,o=class{constructor(r){this.el=r;let i=this.canvas=document.createElement(`canvas`);r.appendChild(i),this.mobile=e(),this.maxQ=this.mobile?.6:.85,this.quality=this.maxQ,this.cA=null,this.cB=null,this.cache=new Map,this.pool=[],this.uB=new Float32Array(40),this.chapter=`home`,this.mouse={x:0,y:0,active:!1},this.balls=Array.from({length:t},(e,t)=>({x:(Math.random()-.5)*3,y:n*1.3+Math.random()*.8,z:0,r:.01,vx:0,vy:0,vz:0,k:3+t%5*.9,tr:.01})),this.trans=null,this.draw=null,this.mix=0,this.fr={n:0,sum:0,good:0,slow:0,hold:performance.now()+1500},this.ceil=this.maxQ,this.ceilAt=0,this.reduce=matchMedia(`(prefers-reduced-motion: reduce)`).matches,this.initGL(),i.addEventListener(`webglcontextlost`,this.onLost=e=>{e.preventDefault(),this.gl=null,this.stop()}),i.addEventListener(`webglcontextrestored`,this.onRestored=()=>{this.initGL(),this.size(),this.cA&&this.upload(0,this.cA),this.cB&&this.upload(1,this.cB),this.start()}),this.size();let a;this.onResize=()=>{clearTimeout(a),a=setTimeout(()=>{this.size(),this.repaint()},120)},addEventListener(`resize`,this.onResize),this.t0=performance.now(),this.last=this.t0,this.loop=e=>{this.raf=requestAnimationFrame(this.loop),this.tick(e)},this.paused=0,this.start(),this.onVis=()=>document.hidden?this.stop():this.start(),document.addEventListener(`visibilitychange`,this.onVis)}initGL(){let e={antialias:!1,alpha:!1,depth:!1,stencil:!1,powerPreference:`high-performance`,preserveDrawingBuffer:!1},t=this.gl=this.canvas.getContext(`webgl`,e)||this.canvas.getContext(`experimental-webgl`,e);if(!t)throw Error(`no webgl`);let n=(e,n)=>{let r=t.createShader(e);if(t.shaderSource(r,n),t.compileShader(r),!t.getShaderParameter(r,t.COMPILE_STATUS)&&!t.isContextLost())throw Error(t.getShaderInfoLog(r));return r},r=t.createProgram();if(t.attachShader(r,n(t.VERTEX_SHADER,i)),t.attachShader(r,n(t.FRAGMENT_SHADER,a)),t.bindAttribLocation(r,0,`aP`),t.linkProgram(r),!t.getProgramParameter(r,t.LINK_STATUS)&&!t.isContextLost())throw Error(t.getProgramInfoLog(r));t.useProgram(r),t.bindBuffer(t.ARRAY_BUFFER,t.createBuffer()),t.bufferData(t.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),t.STATIC_DRAW),t.enableVertexAttribArray(0),t.vertexAttribPointer(0,2,t.FLOAT,!1,0,0);let o=e=>t.getUniformLocation(r,e);this.L={res:o(`uRes`),time:o(`uTime`),mix:o(`uMix`),b:o(`uB`),a:o(`uA`),bt:o(`uBt`)},t.uniform1i(this.L.a,0),t.uniform1i(this.L.bt,1),this.tex=[0,1].map(e=>{let n=t.createTexture();return t.activeTexture(t.TEXTURE0+e),t.bindTexture(t.TEXTURE_2D,n),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,1,1,0,t.RGBA,t.UNSIGNED_BYTE,new Uint8Array([6,6,6,255])),n}),t.pixelStorei(t.UNPACK_FLIP_Y_WEBGL,!0),this.texSize=[],t.disable(t.DEPTH_TEST),t.disable(t.BLEND)}upload(e,t){let n=this.gl;if(!n||!t?.width)return;n.activeTexture(n.TEXTURE0+e),n.bindTexture(n.TEXTURE_2D,this.tex[e]);let r=t.width+`x`+t.height;this.texSize?.[e]===r?n.texSubImage2D(n.TEXTURE_2D,0,0,0,n.RGBA,n.UNSIGNED_BYTE,t):(n.texImage2D(n.TEXTURE_2D,0,n.RGBA,n.RGBA,n.UNSIGNED_BYTE,t),(this.texSize||(this.texSize=[]))[e]=r)}start(){!this.raf&&!this.paused&&!document.hidden&&this.gl&&(this.last=performance.now(),this.raf=requestAnimationFrame(this.loop))}stop(){this.raf&&cancelAnimationFrame(this.raf),this.raf=null}pause(){this.paused=1,this.stop()}resume(){this.paused=0,this.start()}size(){let e=innerWidth,t=innerHeight,n=Math.min(devicePixelRatio||1,2),r=Math.max(1,Math.round(e*n*this.quality)),i=Math.max(1,Math.round(t*n*this.quality));(this.canvas.width!==r||this.canvas.height!==i)&&(this.canvas.width=r,this.canvas.height=i),this.res=[r,i],this.gl&&(this.gl.viewport(0,0,r,i),this.gl.uniform2f(this.L.res,r,i))}posterScale(){return Math.min(devicePixelRatio||1,2)*this.maxQ}canvasFor(){let e=this.pool.pop()||document.createElement(`canvas`),t=this.posterScale(),n=Math.round(innerWidth*t),r=Math.round(innerHeight*t);return(e.width!==n||e.height!==r)&&(e.width=n,e.height=r),e}release(e){e&&this.pool.length<1&&this.pool.push(e)}posterCanvas(e){let t=this.cache.get(e);if(t)return this.cache.delete(e),t;let n=this.canvasFor();return this.paint(n,e),n}prefetch(e){this.want=e.filter(Boolean);for(let[e,t]of this.cache)this.want.includes(e)||(this.cache.delete(e),this.release(t));this.schedule()}schedule(){if(this.idleId)return;let e=()=>{if(this.idleId=0,this.trans){this.idleId=setTimeout(e,400);return}let t=(this.want||[]).find(e=>e!==this.draw&&!this.cache.has(e));if(!t)return;let n=this.canvasFor();this.paint(n,t),this.cache.set(t,n),this.schedule()};this.idleId=window.requestIdleCallback?requestIdleCallback(e,{timeout:1500}):setTimeout(e,300)}repaint(){let t=this.mobile;this.mobile=e(),t!==this.mobile&&(this.maxQ=this.mobile?.6:.85,this.quality=Math.min(this.quality,this.maxQ),this.ceil=this.maxQ,this.size());for(let e of this.cache.values())this.release(e);this.cache.clear(),this.draw&&(this.cA=this.canvasFor(),this.paint(this.cA,this.draw),this.upload(0,this.cA)),this.trans&&(this.cB=this.canvasFor(),this.paint(this.cB,this.trans.draw),this.upload(1,this.cB)),this.schedule()}resize(){this.size(),this.repaint()}paint(e,t){let n=e.getContext(`2d`);n.setTransform(1,0,0,1,0,0),t(n,e.width,e.height,this.mobile)}setPoster(e){this.draw&&this.draw!==e?this.cache.set(this.draw,this.cA):this.release(this.cA),this.draw=e,this.cA=this.posterCanvas(e),this.upload(0,this.cA)}transitionTo(e,t){this.trans&&this.finish(),this.cB=this.posterCanvas(e),this.upload(1,this.cB),this.trans={draw:e,start:performance.now(),dur:this.reduce?10:1500},this.fr.hold=performance.now()+250,this.chapter=t,this.splash(2.2)}finish(){let e=this.trans;if(e){if(this.draw&&this.draw!==e.draw?this.cache.set(this.draw,this.cA):this.release(this.cA),this.cA=this.cB,this.cB=null,this.gl){[this.tex[0],this.tex[1]]=[this.tex[1],this.tex[0]],this.texSize&&this.texSize.reverse();let e=this.gl;e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,this.tex[0]),e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,this.tex[1])}this.draw=e.draw,this.trans=null,this.mix=0,this.want&&this.prefetch(this.want)}}setMouse(e,t){let r=n*innerWidth/innerHeight;this.mouse.x=(e/innerWidth*2-1)*r,this.mouse.y=-(t/innerHeight*2-1)*n,this.mouse.active=!0}splash(e=5){this.balls.forEach((t,n)=>{if(!n)return;let r=Math.random()*6.283;t.vx+=Math.cos(r)*e,t.vy+=Math.sin(r)*e,t.vz+=(Math.random()-.5)*e})}targets(e){let t=innerWidth/innerHeight,r=n*t,i=this.mobile,a=i?.62:Math.min(1,Math.max(.7,t/1.6)),o=[.62,.44,.36,.3,.26,.22,.19,.16,.13].map(e=>e*a),s=[],c=this.chapter;for(let t=0;t<9;t++){let l=t*2.4+e*(.18+t*.045),u,d,f=Math.sin(l)*.35,p=o[t];if(c===`home`){let e=i?r*.25:r*.4,n=i?-1.008:-.144,o=(.15+t*.13)*a*(i?1.1:1.25);u=e+Math.cos(l)*o,d=n+Math.sin(l)*o*(i?.5:.8)}else if(c===`services`){if(t<3)u=(i?[-.42,-.06,-.24]:[-.55,-.18,-.36])[t]*r+Math.sin(e*.35+t*2.1)*.05*r,d=-2.4*(.92+t%3*.03)+Math.cos(e*.3+t)*.03*n,p=(i?.26:.3)*(t===2?.85:1);else{let e=t-3;u=(i?.85:-.35)*r-e*.04*r+Math.cos(l)*.06*r,d=-2.16+Math.sin(l)*.05*n,p*=.7}}else if(c===`works`)u=-r*.92+t/8*r*1.84+Math.sin(e*.6+t)*.15,d=(i?.62:.55)*n+Math.sin(e*.9+t*.8)*.2*n,p=(.16+t*37%9/9*.24)*a*(i?1:1.3);else if(c===`process`){let e=i?r*.55:r*.62,o=i?n*.3:n*.45,s=(.2+t*.09)*a;u=e+Math.cos(l*.7)*s*(i?1:1.6),d=o+Math.sin(l)*s*.5,p*=i?.45:.8}else if(c===`reviews`){let o=i?r*.45:r*.66,s=i?n*.2:n*.36,c=t/9*6.283+e*.2;u=o+Math.cos(c)*.45*a*(i?1.6:1),d=s+Math.sin(c)*.3*a*(i?.4:1),p*=(t%3?.6:.95)*(i?.55:1)}else if(c===`about`){let n=i?0:r*.48,o=i?-1.08:0,s=(i?.55:.85)*a,c=t/9*6.283+e*.25;u=n+Math.cos(c)*s*1.2,d=o+Math.sin(c)*s,f=Math.sin(c*2+e)*.4,p*=.75}else{let e=i?r*.45:r*.52,o=i?n*.72:n*.05;u=e+Math.cos(l)*.32*a,d=o+Math.sin(l)*.28*a,p=(.42+t%3*.1)*a*(i?.7:1)}s.push([u,d,f,p])}return s}govern(e,t){let n=this.fr;if(t<n.hold){n.n=0,n.sum=0;return}if(n.n++,n.sum+=e,n.n<45&&!(n.sum>1&&n.n>=8))return;let r=n.sum/n.n;n.n=0,n.sum=0,r>.03&&this.quality<=.41?++n.slow>=3&&!this.slowSent&&(this.slowSent=!0,this.onSlow?.()):r<.025&&(n.slow=0),this.ceil<this.maxQ&&t-this.ceilAt>15e3&&(this.ceil=Math.min(this.maxQ,this.ceil+.04),this.ceilAt=t),r>.0205&&this.quality>.4?(this.ceil=Math.max(.4,this.quality-.02),this.ceilAt=t,this.quality=Math.max(.4,this.quality-(r>.06?.2:r>.03?.12:.07)),n.good=0,this.size()):r<.0176&&this.quality<this.ceil?++n.good>=4&&(n.good=0,this.quality=Math.min(this.ceil,this.quality+.04),this.size()):n.good=0}tick(e){let t=this.gl;if(!t)return;let n=(e-this.last)/1e3,r=Math.min(.05,n);this.last=e;let i=this.reduce?3:(e-this.t0)/1e3;if(this.govern(Math.min(.25,n),e),this.trans){let t=Math.min(1,(e-this.trans.start)/this.trans.dur);this.mix=t<.5?2*t*t:1-(-2*t+2)**2/2,t>=1&&this.finish()}let a=this.targets(i),o=this.uB;this.balls.forEach((e,t)=>{let n,i,s,c;if(t===0){if(this.mouse.active)n=this.mouse.x,i=this.mouse.y;else{let e=this.chapter===`services`?-.15:.5;n=a[0][0]-.9,i=a[0][1]+e}s=.3,c=(this.chapter===`contact`?.42:.3)*(this.mobile?.7:1)}else[n,i,s,c]=a[t-1];let l=t===0?14:e.k;e.vx+=(n-e.x)*l*r,e.vy+=(i-e.y)*l*r,e.vz+=(s-e.z)*l*r;let u=(t===0?.02:.12)**r;e.vx*=u,e.vy*=u,e.vz*=u,e.x+=e.vx*r,e.y+=e.vy*r,e.z+=e.vz*r,e.r+=(c-e.r)*Math.min(1,r*3),o[t*4]=e.x,o[t*4+1]=e.y,o[t*4+2]=e.z,o[t*4+3]=Math.max(.01,e.r)}),t.uniform1f(this.L.time,i),t.uniform1f(this.L.mix,this.mix),t.uniform4fv(this.L.b,o),t.drawArrays(t.TRIANGLES,0,3)}destroy(){this.stop(),clearTimeout(this.idleId),window.cancelIdleCallback?.(this.idleId),document.removeEventListener(`visibilitychange`,this.onVis),removeEventListener(`resize`,this.onResize),this.canvas.removeEventListener(`webglcontextlost`,this.onLost),this.canvas.removeEventListener(`webglcontextrestored`,this.onRestored),this.gl?.getExtension(`WEBGL_lose_context`)?.loseContext(),this.el.innerHTML=``}};export{o as Liquid};