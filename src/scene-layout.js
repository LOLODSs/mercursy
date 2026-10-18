import { isMobile } from './mq.js'

// The large desktop composition is deliberately unchanged. Smaller screens use
// one shared CSS-pixel coordinate system for both the CSS and WebGL renderers.
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const intersect = (a,b) => {
  const x=Math.max(a.x,b.x), y=Math.max(a.y,b.y)
  return {x,y,width:Math.max(0,Math.min(a.x+a.width,b.x+b.width)-x),height:Math.max(0,Math.min(a.y+a.height,b.y+b.height)-y)}
}
const box = r => ({x:r.left,y:r.top,width:r.width,height:r.height})
const DESKTOP = {
  home:[.69,.18,.20,.43], services:[.08,.89,.42,.065],
  works:[.18,.945,.56,.04], process:[.66,.18,.22,.31],
  reviews:[.68,.19,.20,.33], about:[.72,.20,.16,.32], contact:[.70,.18,.19,.35],
}
function subtract(a,b) {
  const hit=intersect(a,b);if(!hit.width||!hit.height)return[a]
  return [
    {x:a.x,y:a.y,width:a.width,height:hit.y-a.y},
    {x:a.x,y:hit.y+hit.height,width:a.width,height:a.y+a.height-hit.y-hit.height},
    {x:a.x,y:a.y,width:hit.x-a.x,height:a.height},
    {x:hit.x+hit.width,y:a.y,width:a.x+a.width-hit.x-hit.width,height:a.height},
  ].filter(r=>r.width>=48&&r.height>=24)
}
function readLayout(chapter) {
  const w = innerWidth, h = innerHeight, compact = isMobile()
  return { bounded: false, compact, bounds: { x: 0, y: 0, width: w, height: h }, clip: { x: 0, y: 0, width: w, height: h } }
}

export class SceneLayout {
  constructor(onChange) {
    this.onChange=onChange;this.chapter='home';this.frame=0
    this.update=()=>{if(!this.frame)this.frame=requestAnimationFrame(()=>{this.frame=0;this.measure()})}
    this.scroll=e=>{if(!isMobile() && e.target?.classList?.contains('chapter'))this.update()}
    this.ro=new ResizeObserver(this.update)
    this.mo=new MutationObserver(this.update)
    const app=document.querySelector('.app');if(app)this.mo.observe(app,{childList:true})
    addEventListener('resize',this.update);document.addEventListener('scroll',this.scroll,true)
    window.visualViewport?.addEventListener('resize',this.update)
    this.measure()
  }
  setChapter(chapter){this.chapter=chapter;this.measure()}
  measure(){
    if (isMobile()) {
      const next = readLayout(this.chapter), key = JSON.stringify(next)
      if (key !== this.key) { this.key = key; this.current = next; this.onChange?.(next) }
      return
    }
    const slot=document.querySelector(`.scene-slot[data-chapter="${this.chapter}"]`),main=slot?.closest('.chapter')
    if(slot!==this.slot){this.ro.disconnect();this.slot=slot;if(slot)this.ro.observe(slot);if(main)this.ro.observe(main)}
    const next=readLayout(this.chapter),key=JSON.stringify(next)
    if(key!==this.key){this.key=key;this.current=next;this.onChange?.(next)}
  }
  destroy(){cancelAnimationFrame(this.frame);this.ro.disconnect();this.mo.disconnect();removeEventListener('resize',this.update);document.removeEventListener('scroll',this.scroll,true);window.visualViewport?.removeEventListener('resize',this.update)}
}

export function liteObjects(bounds) {
  const d=Math.max(0,Math.min(bounds.height*.74,bounds.width*.44,210))
  return [[.52,.5,d],[.18,.54,d*.40],[.84,.46,d*.25]].map(([x,y,size])=>({x:bounds.x+bounds.width*x,y:bounds.y+bounds.height*y,size}))
}
export function mercuryGeometry(bounds,time,chapter) {
  const unit=4.8/innerHeight,base=Math.max(0,Math.min(bounds.height*.25,bounds.width*.14,76))
  const phase=Object.keys(DESKTOP).indexOf(chapter)*.8
  const seeds=[[-.65,0,1],[.55,.12,.78],[.05,-.5,.58],[1.55,.12,.45],[-1.7,.1,.36],[2.3,-.2,.29],[-2.4,-.25,.24],[1.0,-.65,.2],[-.8,.7,.18]]
  const cx=bounds.x+bounds.width*.5,cy=bounds.y+bounds.height*.5
  const targets=seeds.map(([x,y,r],i)=>{
    const a=time*(.25+i*.025)+phase+i*1.7
    let px=cx+base*(x+Math.sin(a)*.12),py=cy+base*(y+Math.cos(a)*.09),radius=base*r
    const pad=radius+base*.35+2
    px=clamp(px,bounds.x+pad,bounds.x+bounds.width-pad);py=clamp(py,bounds.y+pad,bounds.y+bounds.height-pad)
    return [(px-innerWidth/2)*unit,(innerHeight/2-py)*unit,0,radius*unit]
  })
  return {targets,scale:Math.max(.002,base*unit/.62)}
}
export function constrainBall(ball,bounds,shapeScale) {
  const unit=4.8/innerHeight,pad=ball.r+shapeScale*.25+unit*2
  const x0=(bounds.x-innerWidth/2)*unit+pad,x1=(bounds.x+bounds.width-innerWidth/2)*unit-pad
  const y0=(innerHeight/2-bounds.y-bounds.height)*unit+pad,y1=(innerHeight/2-bounds.y)*unit-pad
  const x=clamp(ball.x,Math.min(x0,x1),Math.max(x0,x1)),y=clamp(ball.y,Math.min(y0,y1),Math.max(y0,y1))
  if(x!==ball.x){ball.x=x;ball.vx=0}if(y!==ball.y){ball.y=y;ball.vy=0}
  ball.z=0;ball.vz=0
}
