import puppeteer from 'puppeteer-core'
import {existsSync,mkdirSync,writeFileSync} from 'node:fs'
const output=process.env.QA_OUTPUT || 'qa-navigation';mkdirSync(output,{recursive:true})
const executablePath=process.env.CHROME_PATH || ['/usr/local/bin/chromium','/usr/bin/chromium','/usr/bin/google-chrome','/usr/bin/vivaldi','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Vivaldi.app/Contents/MacOS/Vivaldi','C:/Program Files/Google/Chrome/Application/chrome.exe',`${process.env.LOCALAPPDATA}/Vivaldi/Application/vivaldi.exe`].find(existsSync)
if(!executablePath) throw new Error('Set CHROME_PATH to an installed Chromium-based browser executable.')
const browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox']})
const base=process.env.QA_URL || 'http://127.0.0.1:4173';const results=[],errors=[]
const pause=ms=>new Promise(r=>setTimeout(r,ms))
try {
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message))
 for(const [width,height] of [[320,568],[375,667],[390,844],[600,390],[640,800],[768,1024],[844,390]]) {
  await page.setViewport({width,height});
  for(const chapter of ['home','services','works','process','reviews','about','contact']) {
   await page.goto(`${base}/?static#${chapter}`,{waitUntil:'load'});await page.waitForSelector('.app.ready');await pause(200)
   const checks=await page.evaluate(()=>{
    const nav=document.querySelector('.nav'),r=nav.getBoundingClientRect(),buttons=[...nav.children].filter(e=>e.tagName==='BUTTON'&&getComputedStyle(e).display!=='none')
    return {buttons:buttons.length,overflow:nav.scrollWidth>nav.clientWidth+1,clipped:buttons.some(e=>{let b=e.getBoundingClientRect();return b.left<r.left||b.right>r.right}),smallTarget:buttons.some(e=>{let b=e.getBoundingClientRect();return b.width<44||b.height<44}),textClipped:buttons.some(e=>{let s=e.querySelector('span');return s&&s.scrollWidth>s.clientWidth+1}),visibleNames:buttons.map(e=>e.textContent.trim())}
   })
   if(checks.buttons!==(width<640?4:7)||checks.overflow||checks.clipped||checks.smallTarget||checks.textClipped) errors.push({width,height,chapter,...checks})
   results.push({width,height,chapter,...checks})
  }
 }
 await page.setViewport({width:375,height:667});await page.goto(`${base}/?static#services`);await page.waitForSelector('.app.ready');await pause(2800)
 await page.screenshot({path:`${output}/services-375.png`});const box=await page.$eval('.nav',e=>{let r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}});await page.screenshot({path:`${output}/nav-375.png`,clip:box})
 await page.click('.nav-more');await pause(200);await page.screenshot({path:`${output}/menu-375.png`})
 const menuChecks=await page.evaluate(()=>{let e=document.querySelector('.nav-extra'),r=e.getBoundingClientRect();return {items:e.querySelectorAll('button').length,inside:r.left>=0&&r.right<=innerWidth&&r.top>=0,focused:e.contains(document.activeElement)}})
 if(menuChecks.items!==4||!menuChecks.inside||!menuChecks.focused)errors.push({menuChecks})
 await page.keyboard.press('Escape');if(!await page.$eval('.nav-more',e=>e.getAttribute('aria-expanded')==='false'&&document.activeElement===e))errors.push('Escape / focus restoration')
 for(const [label,chapter] of [['Процесс','process'],['Отзывы','reviews'],['Обо мне','about'],['Контакт','contact']]){
  await page.click('.nav-more');await pause(100);await page.evaluate(name=>[...document.querySelectorAll('.nav-extra button')].find(b=>b.textContent===name)?.click(),label);await pause(1600)
  if(await page.evaluate(()=>location.hash)!==`#${chapter}`)errors.push(`Cannot reach ${chapter}`)
  if(await page.$('.nav-extra'))errors.push('Menu did not close on selection')
  if(await page.$eval('.nav-more span',e=>e.textContent)!==label)errors.push('Current section label')
 }
 await page.screenshot({path:`${output}/contact-375.png`});await page.click('.nav-more');await page.waitForSelector('.nav-extra');await page.mouse.click(10,100);await pause(100);if(await page.$('.nav-extra'))errors.push('Outside click')
 await page.click('.nav-more');await page.setViewport({width:844,height:390});await pause(300);if(await page.$('.nav-extra'))errors.push('Rotation close')
 await page.screenshot({path:`${output}/landscape-844.png`});
 await page.setViewport({width:320,height:568});await page.goto(`${base}/?static#services`);await page.waitForSelector('.app.ready');await pause(2800);await page.click('.nav-more');await pause(200);await page.screenshot({path:`${output}/menu-320.png`});
 writeFileSync(`${output}/results.json`,JSON.stringify({results,menuChecks,interactionChecks:['All four extra chapters reachable','Escape restores focus','Outside click closes','Selection closes and labels active section','Resize closes menu'],errors},null,2))
 console.log(`Navigation: ${results.length} viewport/chapter combinations; errors: ${errors.length}`);if(errors.length){console.log(errors);process.exitCode=1}
}finally{await browser.close()}
