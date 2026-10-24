'use strict';
const $=id=>document.getElementById(id);
const ids=['name','sku','basis','cost','usd','fx','extra','margin','fee','vat','recover','settlement','growth','round','actual'];
const num=id=>Math.max(0,Number($(id).value)||0);
const fmt=n=>Number.isFinite(n)?Math.round(n).toLocaleString('fa-IR'):'—';
const periods={now:[[0,1]],m1:[[1,1]],m2:[[2,1]],split2:[[1,.5],[2,.5]],split4:[[1,.25],[2,.25],[3,.25],[4,.25]]};
const key='mouher-pricing-products-v1';let result;
function calculate(){
 $('tomanCost').hidden=$('basis').value!=='toman';$('usdCost').hidden=$('basis').value!=='usd';
 const replacement=$('basis').value==='toman'?num('cost'):num('usd')*num('fx');
 const cost=replacement+num('extra'), margin=Math.min(.9,num('margin')/100),tax=$('recover').checked?0:num('vat')/100;
 const retention=1-(num('fee')/100)*(1+tax),growth=num('growth')/100;
 const schedule=periods[$('settlement').value]||periods.now;
 const discount=schedule.reduce((a,[month,share])=>a+share/Math.pow(1+growth,month),0);
 const round=num('round')||10000,up=n=>Math.ceil(n/round)*round;
 const cash=up(cost/(1-margin)),bnpl=retention>0?up(cost/(1-margin)/retention/discount):NaN;
 const selling=$('actual').value.trim()?num('actual'):cash;
 const nominal=selling*retention,pv=nominal*discount,profit=pv-cost;
 const missing=[];if(!replacement)missing.push('هزینه خرید مجدد');if(!$('fee').value.trim())missing.push('درصد کارمزد قراردادی');if(!$('growth').value.trim())missing.push('برآورد رشد هزینه تأمین');if(retention<=0)missing.push('کارمزد نامعتبر');
 $('missing').hidden=!missing.length;$('missing').textContent=missing.length?'برای نتیجه قابل اتکا وارد کنید: '+missing.join('، '):'';
 [['cash',cash],['bnpl',bnpl],['totalCost',cost],['deductions',selling*(1-retention)],['nominal',nominal],['pv',pv],['profit',profit]].forEach(([id,v])=>$(id).textContent=fmt(v)+(id==='cash'||id==='bnpl'?'':' تومان'));
 $('profit').style.color=profit<0?'#b34242':'#176344';
 const body=$('scheduleBody');body.replaceChildren();schedule.forEach(([m,share])=>{const tr=document.createElement('tr');[m===0?'اکنون':'ماه '+fmt(m),fmt(nominal*share),fmt(nominal*share/Math.pow(1+growth,m))].forEach(v=>{const cell=document.createElement('td');cell.textContent=v;tr.append(cell)});body.append(tr)});
 result={cash,bnpl,cost,nominal,pv,profit,ready:!missing.length};
}
const snapshot=()=>Object.fromEntries(ids.map(id=>[id,$(id).type==='checkbox'?$(id).checked:$(id).value]));
function load(s){ids.forEach(id=>{if(s[id]!==undefined){if($(id).type==='checkbox')$(id).checked=!!s[id];else $(id).value=String(s[id])}});calculate()}
function saved(){try{const list=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(list)?list:[]}catch{return []}}
function persist(items){localStorage.setItem(key,JSON.stringify(items));render()}
function show(tab){document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id===tab));document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('primary',b.dataset.tab===tab))}
function render(){const container=$('productList');container.replaceChildren();const list=saved();if(!list.length){container.textContent='هنوز محصولی ذخیره نشده است.';return}list.forEach((entry,i)=>{const row=document.createElement('div'),title=document.createElement('div'),b=document.createElement('b'),desc=document.createElement('p'),open=document.createElement('button'),del=document.createElement('button');row.className='saved';b.textContent=entry.data.name||'بدون نام';desc.textContent=(entry.data.sku||'بدون کد')+' · '+new Date(entry.at).toLocaleDateString('fa-IR');title.append(b,desc);open.textContent='بازکردن';open.onclick=()=>{load(entry.data);show('calculator');window.scrollTo(0,0)};del.textContent='حذف';del.onclick=()=>{if(confirm('این محصول حذف شود؟'))persist(saved().filter((_,j)=>j!==i))};const buttons=document.createElement('div');buttons.append(open,del);row.append(title,buttons);container.append(row)})}
ids.forEach(id=>{['input','change'].forEach(event=>$(id).addEventListener(event,calculate))});
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>show(b.dataset.tab));
$('save').onclick=()=>{if(!$('name').value.trim())return alert('نام محصول را وارد کنید.');const items=saved(),data=snapshot(),at=new Date().toISOString();const same=items.findIndex(x=>data.sku&&x.data.sku===data.sku);if(same>=0){if(!confirm('محصول دارای همین کد جایگزین شود؟'))return;items[same]={data,at}}else items.unshift({data,at});try{persist(items);alert('محصول در همین دستگاه ذخیره شد.')}catch{alert('ذخیره در این مرورگر ممکن نیست.')}};
$('copy').onclick=async()=>{const t='موهر - '+($('name').value||'محصول')+'\nقیمت نقدی: '+fmt(result.cash)+' تومان\nقیمت نظری اقساطی: '+fmt(result.bnpl)+' تومان\nمشارکت اقتصادی: '+fmt(result.profit)+' تومان';try{await navigator.clipboard.writeText(t);alert('نتایج کپی شد')}catch{prompt('متن را کپی کنید',t)}};
function download(filename,data,type){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('export').onclick=()=>download('mouher-pricing-backup.json',JSON.stringify({version:1,products:saved()},null,2),'application/json');
$('csv').onclick=()=>{const cols=['name','sku','basis','cost','usd','fx','extra','margin','fee','vat','settlement','growth'];const rows=[cols,...saved().map(x=>cols.map(k=>x.data[k]||''))];download('mouher-pricing-products.csv','\ufeff'+rows.map(r=>r.map(x=>'"'+String(x).replaceAll('"','""')+'"').join(',')).join('\r\n'),'text/csv;charset=utf-8')};
$('import').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());if(data.version!==1||!Array.isArray(data.products)||data.products.length>10000||!data.products.every(x=>x&&x.data&&typeof x.data==='object'))throw Error();if(confirm('محصولات فعلی با نسخه پشتیبان جایگزین شوند؟'))persist(data.products)}catch{alert('نسخه پشتیبان نامعتبر است')}e.target.value=''};
render();calculate();if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));