'use strict';
const $=id=>document.getElementById(id);
const ids=['installmentEnabled','collection','category','name','sku','basis','cost','usd','fx','extra','margin','fee','vat','recover','settlement','growth','round','actual'];
const num=id=>Math.max(0,Number($(id).value)||0);
const fmt=n=>Number.isFinite(n)?Math.round(n).toLocaleString('fa-IR'):'—';
const periods={now:[[0,1]],m1:[[1,1]],m2:[[2,1]],split2:[[1,.5],[2,.5]],split4:[[1,.25],[2,.25],[3,.25],[4,.25]]};
const shopKey='mouher-shop-name-v1';$('shopName').value=localStorage.getItem(shopKey)||'Mouher';$('shopName').addEventListener('change',()=>localStorage.setItem(shopKey,$('shopName').value.trim()||'Mouher'));
const key='mouher-pricing-products-v1';let result;let currentPhoto='';
function previewPhoto(){const im=$('photoPreview');im.hidden=!currentPhoto;im.src=currentPhoto||'';$('removePhoto').hidden=!currentPhoto;}
$('photo').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;if(!file.type.startsWith('image/')||file.size>15*1024*1024){alert('لطفاً عکس کمتر از ۱۵ مگابایت انتخاب کنید.');event.target.value='';return;}try{const bitmap=await createImageBitmap(file);const scale=Math.min(1,440/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);currentPhoto=canvas.toDataURL('image/jpeg',.68);bitmap.close?.();previewPhoto();}catch{alert('خواندن این عکس ممکن نیست. یک فایل JPEG یا PNG انتخاب کنید.')}event.target.value=''});
$('removePhoto').onclick=()=>{currentPhoto='';previewPhoto()};
function calculate(){
 const installment=$('installmentEnabled').checked;
 $('installmentFields').hidden=!installment;
 ['bnplResult','deductionsRow','nominalRow','pvRow','settlementResults'].forEach(id=>$(id).hidden=!installment);
 $('tomanCost').hidden=$('basis').value!=='toman';$('usdCost').hidden=$('basis').value!=='usd';
 const replacement=$('basis').value==='toman'?num('cost'):num('usd')*num('fx');
 const cost=replacement+num('extra'), margin=Math.min(.9,num('margin')/100),tax=$('recover').checked?0:num('vat')/100;
 const retention=installment?1-(num('fee')/100)*(1+tax):1,growth=installment?num('growth')/100:0;
 const schedule=periods[$('settlement').value]||periods.now;
 const discount=schedule.reduce((a,[month,share])=>a+share/Math.pow(1+growth,month),0);
 const round=num('round')||10000,up=n=>Math.ceil(n/round)*round;
 const cash=up(cost/(1-margin)),bnpl=retention>0?up(cost/(1-margin)/retention/discount):NaN;
 const selling=$('actual').value.trim()?num('actual'):cash;
 const nominal=selling*retention,pv=nominal*discount,profit=pv-cost;
 const missing=[];if(!replacement)missing.push('هزینه ساخت یا خرید مجدد');if(installment&&!$('fee').value.trim())missing.push('درصد کارمزد قراردادی');if(installment&&!$('growth').value.trim())missing.push('برآورد رشد هزینه تأمین');if(installment&&retention<=0)missing.push('کارمزد نامعتبر');
 $('missing').hidden=!missing.length;$('missing').textContent=missing.length?'برای نتیجه قابل اتکا وارد کنید: '+missing.join('، '):'';
 [['cash',cash],['bnpl',bnpl],['totalCost',cost],['deductions',selling*(1-retention)],['nominal',nominal],['pv',pv],['profit',profit]].forEach(([id,v])=>$(id).textContent=fmt(v)+(id==='cash'||id==='bnpl'?'':' تومان'));
 $('profit').style.color=profit<0?'#b34242':'#176344';
 const body=$('scheduleBody');body.replaceChildren();schedule.forEach(([m,share])=>{const tr=document.createElement('tr');[m===0?'اکنون':'ماه '+fmt(m),fmt(nominal*share),fmt(nominal*share/Math.pow(1+growth,m))].forEach(v=>{const cell=document.createElement('td');cell.textContent=v;tr.append(cell)});body.append(tr)});
 result={cash,bnpl,cost,nominal,pv,profit,ready:!missing.length};
}

function priceFor(d){
 const n=k=>Math.max(0,Number(d[k])||0);
 const replacement=d.basis==='usd'?n('usd')*n('fx'):n('cost');
 const total=replacement+n('extra'), margin=Math.min(.9,n('margin')/100),fee=n('fee')/100;
 const installment=d.installmentEnabled===true||d.installmentEnabled==='true'||(d.installmentEnabled===undefined&&String(d.fee||'').trim()!=='');
 const retained=installment?1-fee*(1+(d.recover?0:n('vat')/100)):1;
 const g=installment?n('growth')/100:0, stages=installment?(periods[d.settlement]||periods.now):periods.now;
 const df=stages.reduce((sum,[months,part])=>sum+part/Math.pow(1+g,months),0);
 const step=n('round')||10000;
 const up=x=>Math.ceil(x/step)*step;
 const valid=replacement>0&&margin>=0&&margin<1&&retained>0&&(!installment||(String(d.fee||'').trim()!==''&&String(d.growth||'').trim()!==''));
 const cash=valid?up(total/(1-margin)):null;
 const bnpl=valid&&installment?up(total/(1-margin)/retained/df):null;
 const actual=String(d.actual||'').trim()?n('actual'):cash;
 const pv=valid?actual*retained*df:null;
 return {valid,installment,cash,bnpl,actual,total,pv,contribution:valid?pv-total:null};
}

const snapshot=()=>({...Object.fromEntries(ids.map(id=>[id,$(id).type==='checkbox'?$(id).checked:$(id).value])),photo:currentPhoto});
function load(s){currentPhoto=typeof s.photo==='string'&&s.photo.startsWith('data:image/jpeg;base64,')?s.photo:'';previewPhoto();ids.forEach(id=>{if(s[id]!==undefined){if($(id).type==='checkbox')$(id).checked=!!s[id];else $(id).value=String(s[id])}});calculate()}
function saved(){try{const list=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(list)?list:[]}catch{return []}}
function persist(items){localStorage.setItem(key,JSON.stringify(items));render();renderStore()}
function show(tab){document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id===tab));document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('primary',b.dataset.tab===tab))}
function render(){
 const container=$('productList');container.replaceChildren();
 const q=($('searchProducts')?.value||'').trim().toLowerCase();
 const all=saved(),shown=all.map((entry,i)=>({entry,i})).filter(({entry})=>(entry.data.name+' '+(entry.data.sku||'')).toLowerCase().includes(q));
 $('productCount').textContent=all.length.toLocaleString('fa-IR')+' محصول ثبت‌شده';
 if(!shown.length){container.textContent=q?'محصولی با این جستجو پیدا نشد.':'هنوز محصولی ذخیره نشده است.';return}
 shown.forEach(({entry,i})=>{
  const d=entry.data,p=priceFor(d),row=document.createElement('div'),title=document.createElement('div'),b=document.createElement('b'),desc=document.createElement('p'),pricing=document.createElement('p'),open=document.createElement('button'),del=document.createElement('button');
  row.className='saved';row.style.alignItems='flex-start';b.textContent=d.name||'بدون نام';
  desc.textContent=(d.sku||'بدون کد')+' · '+new Date(entry.at).toLocaleDateString('fa-IR');
  pricing.textContent=p.valid?'نقدی: '+fmt(p.cash)+(p.installment?' | اقساط نظری: '+fmt(p.bnpl):'')+' تومان':'⚠ اطلاعات لازم برای قیمت‌گذاری کامل نیست';
  pricing.style.color=p.valid?'#176344':'#a05b20';pricing.style.fontWeight='bold';title.append(b,desc,pricing);if(typeof d.photo==='string'&&d.photo.startsWith('data:image/jpeg;base64,')){const thumb=document.createElement('img');thumb.src=d.photo;thumb.alt='عکس محصول';thumb.width=70;thumb.height=70;thumb.style.cssText='width:70px;height:70px;object-fit:cover;border-radius:12px';row.append(thumb);const share=document.createElement('button');share.textContent='اشتراک عکس';share.onclick=()=>shareProductPhoto(d.photo,d.sku||d.name||'product');title.append(share)}
  open.textContent='ویرایش';open.onclick=()=>{load(d);show('calculator');window.scrollTo(0,0)};
  del.textContent='حذف';del.onclick=()=>{if(confirm('این محصول حذف شود؟'))persist(saved().filter((_,j)=>j!==i))};
  const buttons=document.createElement('div');buttons.style.display='flex';buttons.style.gap='6px';buttons.append(open,del);
  row.append(title,buttons);container.append(row)
 })
}

ids.forEach(id=>{['input','change'].forEach(event=>$(id).addEventListener(event,calculate))});
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>show(b.dataset.tab));
$('save').onclick=()=>{if(!$('name').value.trim())return alert('نام محصول را وارد کنید.');const items=saved(),data=snapshot(),at=new Date().toISOString();const same=items.findIndex(x=>data.sku&&x.data.sku===data.sku&&(x.data.collection||'')===(data.collection||'')&&(x.data.category||'')===(data.category||''));if(same>=0){if(!confirm('محصول دارای همین کد جایگزین شود؟'))return;items[same]={data,at}}else items.unshift({data,at});try{persist(items);recordPriceHistory(data,at);alert('محصول و نسخه قیمت در همین دستگاه ذخیره شد.')}catch{alert('ذخیره در این مرورگر ممکن نیست.')}};
$('copy').onclick=async()=>{const t='موهر - '+($('name').value||'محصول')+'\nقیمت نقدی: '+fmt(result.cash)+' تومان\nقیمت نظری اقساطی: '+fmt(result.bnpl)+' تومان\nمشارکت اقتصادی: '+fmt(result.profit)+' تومان';try{await navigator.clipboard.writeText(t);alert('نتایج کپی شد')}catch{prompt('متن را کپی کنید',t)}};
function download(filename,data,type){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('export').onclick=()=>download('mouher-pricing-backup.json',JSON.stringify({version:1,products:saved()},null,2),'application/json');
async function shareProductPhoto(data,filename){
 if(!data||!data.startsWith('data:image/jpeg;base64,')){alert('ابتدا عکس محصول را انتخاب کنید.');return}
 const bytes=Uint8Array.from(atob(data.split(',')[1]),c=>c.charCodeAt(0));
 const safe=String(filename).replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,70)||'product';
 const file=new File([bytes],safe+'.jpg',{type:'image/jpeg'});
 if(navigator.canShare?.({files:[file]})&&navigator.share){
  try{await navigator.share({files:[file],title:'عکس محصول موهر'});return}catch(e){if(e.name==='AbortError')return}
 }
 const url=URL.createObjectURL(file);const a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 alert('عکس دانلود شد. برای ارسال به Google Drive آن را از Files بارگذاری کنید.');
}
$('sharePhoto').onclick=()=>shareProductPhoto(currentPhoto,$('sku').value||$('name').value||'product');
async function shareFile(filename,content,type){
 const file=new File([content],filename,{type});
 if(navigator.canShare&&navigator.canShare({files:[file]})&&navigator.share){
  try{await navigator.share({files:[file],title:'فایل قیمت‌گذاری موهر'});return}
  catch(error){if(error.name==='AbortError')return}
 }
 download(filename,content,type);
 alert('فایل دانلود شد. از برنامه Files یا Downloads آیفون، Share را بزنید و Google Drive را انتخاب کنید. اگر Drive نصب نیست، آن را نصب و وارد حساب خود شوید.');
}
$('shareBackup').onclick=()=>shareFile('mouher-pricing-backup.json',JSON.stringify({version:1,products:saved()},null,2),'application/json');

function exportCsv(share=false){
 const columns=['نام محصول','کد کالا','کالکشن','دسته','روش فروش','مبنای هزینه','هزینه جایگزینی تومان','هزینه مستقیم کل تومان','حاشیه هدف درصد','کارمزد درصد','مالیات کارمزد درصد','مالیات قابل بازیافت','برنامه تسویه','رشد ماهانه درصد','قیمت نقدی پیشنهادی تومان','قیمت نظری اقساطی تومان','قیمت فروش بررسی شده تومان','ارزش اقتصادی وجوه تومان','مشارکت اقتصادی تومان','وضعیت','آخرین ذخیره'];
 const records=saved().map(({data:d,at})=>{const p=priceFor(d);return [d.name||'',d.sku||'',d.collection||'',d.category||'',p.installment?'نقدی و اقساطی':'فقط نقدی',d.basis||'toman',d.basis==='usd'?(Number(d.usd)||0)*(Number(d.fx)||0):d.cost||0,p.total,d.margin||'',d.fee||'',d.vat||'',d.recover?'بله':'خیر',d.settlement||'',d.growth||'',p.valid?p.cash:'',p.valid&&p.installment?p.bnpl:'',p.valid?p.actual:'',p.valid?Math.round(p.pv):'',p.valid?Math.round(p.contribution):'',p.valid?'آماده بررسی':'ناقص',at];
 });
 const escapeCell=x=>{let v=String(x??'');if(/^[\s\u0000-\u001f]*[=+@-]/u.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"'};
 const csv='\ufeff'+[columns,...records].map(r=>r.map(escapeCell).join(',')).join('\r\n');if(share==='return')return csv;if(share)return shareFile('mouher-price-list.csv',csv,'text/csv;charset=utf-8');download('mouher-price-list.csv',csv,'text/csv;charset=utf-8');
}
$('csv').onclick=()=>exportCsv(false);
$('webCsvDownload').onclick=()=>exportCsv(false);
$('webBackupDownload').onclick=()=>$('export').click();
$('webImagesDownload').onclick=()=>{
 const photos=saved().filter(x=>typeof x.data?.photo==='string'&&x.data.photo.startsWith('data:image/jpeg;base64,'));
 if(!photos.length)return alert('عکس ذخیره‌شده‌ای وجود ندارد.');
 if(!confirm('تعداد '+photos.length+' تصویر دانلود شود؟ ممکن است Safari اجازه دانلود چند فایل را درخواست کند.'))return;
 for(let i=0;i<photos.length;i++){
  const d=photos[i].data;
  const bytes=Uint8Array.from(atob(d.photo.split(',')[1]),c=>c.charCodeAt(0));
  const name=String(d.sku||'product-'+(i+1)).replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,70);
  download(name+'.jpg',bytes,'image/jpeg');
 }
};

$('shareCsv').onclick=()=>exportCsv(true);
$('searchProducts').addEventListener('input',render);

$('import').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());if(file.size>8*1024*1024||data.version!==1||!Array.isArray(data.products)||data.products.length>500||!data.products.every(x=>x&&x.data&&typeof x.data==='object'&&!Array.isArray(x.data)&&typeof x.data.name==='string'&&x.data.name.length<=200&&(!x.data.sku||typeof x.data.sku==='string'&&x.data.sku.length<=100)&&(!x.data.photo||typeof x.data.photo==='string'&&x.data.photo.length<=160000&&x.data.photo.startsWith('data:image/jpeg;base64,'))&&typeof x.at==='string'&&x.at.length<=100))throw Error();if(confirm('محصولات فعلی با نسخه پشتیبان جایگزین شوند؟'))persist(data.products)}catch{alert('نسخه پشتیبان نامعتبر است')}e.target.value=''};

const historyKey='mouher-pricing-history-v1',salesKey='mouher-store-sales-v1',fixedKey='mouher-store-fixed-v1';
function readStore(k,fallback){try{const x=JSON.parse(localStorage.getItem(k)||'null');return x??fallback}catch{return fallback}}
function history(){const h=readStore(historyKey,[]);return Array.isArray(h)?h.filter(e=>e&&e.data&&typeof e.at==='string').slice(0,1000):[]}
function recordPriceHistory(data,at){const h=history();h.unshift({id:at+'-'+Math.random().toString(36).slice(2,9),at,data:{...data,photo:''}});try{localStorage.setItem(historyKey,JSON.stringify(h.slice(0,1000)));renderStore()}catch{alert('محصول ذخیره شد، ولی فضای تاریخچه پر است. از داده‌ها نسخه پشتیبان بگیر.')}} 
function identity(d){const collection=String(d.collection||'بدون مجموعه').trim()||'بدون مجموعه',category=String(d.category||'بدون دسته').trim()||'بدون دسته';const name=String(d.sku||d.name||'بدون نام').trim().toLocaleLowerCase('fa-IR');return JSON.stringify([collection,category,name])}
function storeRows(){const h=history(),known=new Set(h.map(e=>identity(e.data)));const legacy=saved().filter(e=>!known.has(identity(e.data))).map((e,i)=>({id:'saved-'+i+'-'+e.at,at:e.at,data:e.data}));return [...h,...legacy].sort((a,b)=>b.at.localeCompare(a.at))}
const money=n=>fmt(n)+' تومان';

// Historical recommendations are proposals, never automatic website writes.
const approvalKey='mouher-approved-storefront-prices-v1';
function recommendPrices(){
 const grouped=new Map();
 for(const entry of storeRows()){const key=identity(entry.data);if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(entry)}
 const list=$('recommendationList');list.replaceChildren();
 const approvals=readStore(approvalKey,{});
 if(!grouped.size){list.textContent='هنوز محصولی ذخیره نشده است.';return}
 for(const [key,entries] of grouped){
  entries.sort((a,b)=>a.at.localeCompare(b.at));const latest=entries[entries.length-1],p=priceFor(latest.data);
  if(!p.valid)continue;
  const older=entries.slice(0,-1).filter(e=>priceFor(e.data).valid),previous=older.at(-1),previousPrice=previous?priceFor(previous.data):null;
  const oldCost=previousPrice?.total||null,change=oldCost>0?(p.total/oldCost-1)*100:null;
  const suggested=p.cash; // Today's verified inputs and target margin are the price floor basis.
  const card=document.createElement('div');card.className='saved';card.style.display='block';
  const heading=document.createElement('strong');heading.textContent=(latest.data.collection||'بدون مجموعه')+' / '+(latest.data.category||'بدون دسته')+' / '+(latest.data.name||'بدون نام');
  const desc=document.createElement('p');desc.textContent='هزینه آخرین محاسبه: '+money(p.total)+' | حاشیه هدف: '+fmt(Number(latest.data.margin)||0)+'٪ | پیشنهاد نقدی: '+money(suggested);
  const detail=document.createElement('p');detail.textContent=previousPrice?'نسخه قبل: هزینه '+money(previousPrice.total)+' و قیمت نقدی '+money(previousPrice.cash)+' | تغییر هزینه: '+(change===null?'نامشخص':change.toLocaleString('fa-IR',{maximumFractionDigits:1})+'٪'):'فقط یک نسخه قیمت داریم؛ پیشنهاد براساس هزینه فعلی است، نه روند تاریخی.';
  const explain=document.createElement('p');explain.textContent='محاسبه: ('+fmt(p.total)+' ÷ (۱ − '+fmt(Number(latest.data.margin)||0)+'٪)) و گردکردن به بالا = '+money(suggested)+'. فروش ثبت‌شده در این مرحله تقاضای آینده را پیش‌بینی نمی‌کند.';
  const state=document.createElement('p');const approved=approvals[key];state.textContent=approved?'آخرین تأیید محلی: '+money(approved.price)+' در '+new Date(approved.approvedAt).toLocaleDateString('fa-IR'):'هنوز برای وب‌سایت تأیید نشده';
  const button=document.createElement('button');button.type='button';button.textContent='تأیید قیمت پیشنهادی برای خروجی سایت';
  button.onclick=()=>{if(!confirm('قیمت '+money(suggested)+' برای '+(latest.data.name||'این محصول')+' تأیید شود؟ این کار سایت را تغییر نمی‌دهد.'))return;const records=readStore(approvalKey,{});records[key]={collection:latest.data.collection||'',category:latest.data.category||'',sku:latest.data.sku||'',name:latest.data.name||'',price:suggested,approvedAt:new Date().toISOString(),sourceAt:latest.at,currency:'TOMAN'};localStorage.setItem(approvalKey,JSON.stringify(records));recommendPrices()};
  card.append(heading,desc,detail,explain,state,button);list.append(card)
 }
}
$('approvedPriceExport').onclick=()=>{
 const data=Object.values(readStore(approvalKey,{}));if(!data.length){$('publishStatus').textContent='هنوز قیمتی تأیید نشده است.';return}
 const rows=[['collection','category','sku','product_name','approved_price_toman','approved_at','source_calculation_at'],...data.map(d=>[d.collection,d.category,d.sku,d.name,d.price,d.approvedAt,d.sourceAt])];
 const safe=x=>{let v=String(x??'');if(/^[\\s]*[=+@-]/u.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"'};
 const csv='\ufeff'+rows.map(row=>row.map(safe).join(',')).join('\r\n');
 download('mouher-approved-website-prices.csv',csv,'text/csv;charset=utf-8');
 $('publishStatus').textContent='فایل قیمت‌های تأییدشده دانلود شد؛ برای انتشار در سایت باید جداگانه وارد سیستم فروشگاه شود.'
};

function renderStore(){
 recommendPrices();
 const month=$('storeMonth').value;if(!month)return;
 const sales=readStore(salesKey,{}),fixed=readStore(fixedKey,{}),monthly=Number(fixed[month])||0;
 $('storeFixed').value=monthly;
 const container=$('storeHistory');container.replaceChildren();const groupPanel=$('storeGroups');groupPanel.replaceChildren();const groupTotals=new Map();const perItem=new Map();
 let revenue=0,variable=0,fees=0,shown=0;
 for(const entry of storeRows()){
  const p=priceFor(entry.data);if(!p.valid)continue;
  const id=identity(entry.data);let group=perItem.get(id);if(!group){group=document.createElement('details');group.className='card';const summary=document.createElement('summary');summary.textContent=(entry.data.collection||'بدون مجموعه')+' ← '+(entry.data.category||'بدون دسته')+' ← '+(entry.data.name||'بدون نام')+' ('+(entry.data.sku||'بدون کد')+')';group.append(summary);perItem.set(id,group);container.append(group)}
  const row=document.createElement('div');row.className='saved';row.style.display='block';
  const title=document.createElement('b');title.textContent=(entry.data.name||'بدون نام')+' · '+new Date(entry.at).toLocaleDateString('fa-IR');
  const detail=document.createElement('p');detail.textContent='هزینه واحد: '+money(p.total)+' | نقدی: '+money(p.cash)+(p.installment?' | اقساط نظری: '+money(p.bnpl):'');
  row.append(title,detail);
  const modeIds=p.installment?['cash','bnpl']:['cash'];
  for(const mode of modeIds){
   const key=month+'|'+entry.id+'|'+mode,qty=Math.max(0,Math.floor(Number(sales[key])||0));
   const field=document.createElement('label');field.textContent=(mode==='cash'?'تعداد فروش نقدی':'تعداد فروش با اسنپ‌پی')+' در این ماه';
   const input=document.createElement('input');input.type='number';input.min='0';input.step='1';input.value=qty;input.style.maxWidth='180px';
   input.addEventListener('change',()=>{const value=Number(input.value);if(!Number.isFinite(value)||value<0||!Number.isInteger(value)||value>100000){alert('تعداد باید عدد صحیح بین ۰ و ۱۰۰٬۰۰۰ باشد.');renderStore();return}const fresh=readStore(salesKey,{});if(value)fresh[key]=value;else delete fresh[key];localStorage.setItem(salesKey,JSON.stringify(fresh));renderStore()});
   field.append(input);row.append(field);
   const price=entry.data.actual&&Number(entry.data.actual)>0?Number(entry.data.actual):p.cash;
   const fee=mode==='bnpl'?price*(1-(1-(Number(entry.data.fee)||0)/100*(1+(entry.data.recover?0:(Number(entry.data.vat)||0)/100)))):0;
   revenue+=qty*price;variable+=qty*p.total;fees+=qty*fee;
   const collection=String(entry.data.collection||'بدون مجموعه'),category=String(entry.data.category||'بدون دسته');
   for(const [level,title] of [['collection',collection],['category',collection+' / '+category],['item',collection+' / '+category+' / '+String(entry.data.sku||entry.data.name||'بدون نام')]]){const k=level+'|'+title,old=groupTotals.get(k)||{level,title,qty:0,revenue:0,cost:0,fees:0};old.qty+=qty;old.revenue+=qty*price;old.cost+=qty*p.total;old.fees+=qty*fee;groupTotals.set(k,old)}
  }
  group.append(row);shown++;
 }
 if(!shown){container.textContent='هنوز محاسبه قیمت ذخیره‌شده‌ای نداری. اول در «محاسبه» یک محصول ذخیره کن.'}
 const level=$('storeGroup').value;for(const g of [...groupTotals.values()].filter(x=>x.level===level).sort((a,b)=>a.title.localeCompare(b.title,'fa'))){const el=document.createElement('div');el.className='saved';el.style.display='block';const title=document.createElement('strong');title.textContent=g.title;const detail=document.createElement('p');detail.textContent='تعداد فروش: '+fmt(g.qty)+' | درآمد: '+money(g.revenue)+' | هزینه مستقیم: '+money(g.cost)+' | کارمزد: '+money(g.fees)+' | مانده پیش از هزینه ثابت: '+money(g.revenue-g.cost-g.fees);el.append(title,detail);groupPanel.append(el)}
 const gross=revenue-variable-fees,net=gross-monthly;
 for(const [id,val] of Object.entries({storeRevenue:revenue,storeVariable:variable,storeFee:fees,storeGross:gross,storeFixedOut:monthly,storeNet:net}))$(id).textContent=money(val);
 $('storeNet').style.color=net<0?'#b34242':'#176344';
}
$('storeMonth').value=new Date().toISOString().slice(0,7);
$('storeMonth').addEventListener('change',renderStore);$('storeGroup').addEventListener('change',renderStore);
$('storeFixed').addEventListener('change',()=>{const x=Number($('storeFixed').value);if(!Number.isFinite(x)||x<0){alert('هزینه نمی‌تواند منفی باشد');renderStore();return}const a=readStore(fixedKey,{});a[$('storeMonth').value]=x;localStorage.setItem(fixedKey,JSON.stringify(a));renderStore()});
$('storeExport').onclick=()=>{const m=$('storeMonth').value;const s=readStore(salesKey,{});const rows=[['نام محصول','کالکشن','دسته','تاریخ محاسبه','روش فروش','تعداد','قیمت واحد تومان','هزینه مستقیم واحد تومان','کارمزد واحد تومان','جمع فروش','جمع هزینه مستقیم','جمع کارمزد']];
for(const e of storeRows()){const p=priceFor(e.data);if(!p.valid)continue;for(const mode of p.installment?['cash','bnpl']:['cash']){const q=Number(s[m+'|'+e.id+'|'+mode])||0;if(!q)continue;const price=Number(e.data.actual)>0?Number(e.data.actual):p.cash,fee=mode==='bnpl'?price*(Number(e.data.fee)||0)/100*(1+(e.data.recover?0:(Number(e.data.vat)||0)/100)):0;rows.push([e.data.name||'',e.data.collection||'',e.data.category||'',e.at,mode='cash'?'نقدی':'اسنپ‌پی',q,price,p.total,fee,q*price,q*p.total,q*fee])}}
rows.push(['هزینه ثابت ماه',m,'','','','','', '',Number($('storeFixed').value)||0,'']);const csv='\ufeff'+rows.map(row=>row.map(v=>{let cell=String(v??'');if(/^[\s]*[=+@-]/.test(cell))cell="'"+cell;return '"'+cell.replaceAll('"','""')+'"'}).join(',')).join('\r\n');download('mouher-store-'+m+'.csv',csv,'text/csv;charset=utf-8')};

render();renderStore();calculate();if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
// Keep the guide in its own scrollable frame; native scrolling works on iPhone.
if(location.hash==='#guide')show('guide');
window.addEventListener('hashchange',()=>{if(location.hash==='#guide')show('guide');else if(location.hash==='#calculator')show('calculator')});

(function initInflationAnalysis(){
const get=id=>document.getElementById(id);
const money=n=>Number.isFinite(n)?Math.round(n).toLocaleString('fa-IR')+' تومان':'—';
let annual=null,manual=get('growth').value;
const preview=()=>{
 const n=id=>Math.max(0,Number(get(id).value)||0);
 const replacement=get('basis').value==='usd'?n('usd')*n('fx'):n('cost');
 const cost=replacement+n('extra'),margin=Math.min(.9,n('margin')/100),retained=1-n('fee')/100*(1+(get('recover').checked?0:n('vat')/100));
 const schedule=periods[get('settlement').value]||periods.now,growth=n('inflationScenario')/100;
 const discount=schedule.reduce((sum,[month,share])=>sum+share/Math.pow(1+growth,month),0);
 const step=n('round')||10000,up=value=>Math.ceil(value/step)*step;
 get('inflationCashPreview').textContent=money(up(cost/(1-margin)));
 get('inflationBnplPreview').textContent=get('installmentEnabled').checked?money(retained>0&&discount>0?up(cost/(1-margin)/retained/discount):NaN):'اختیاری؛ حالت اقساطی را فعال کنید';
};
get('inflationApply').onclick=()=>{if(annual!==null){get('inflationScenario').value=(100*(Math.pow(1+annual/100,1/12)-1)).toFixed(2);preview()}};
get('inflationManual').onclick=()=>{get('inflationScenario').value=manual;preview()};
get('inflationUseScenario').onclick=()=>{get('growth').value=get('inflationScenario').value;get('growth').dispatchEvent(new Event('input',{bubbles:true}));get('inflationStatus').textContent='سناریوی انتخابی اعمال شد؛ برای ذخیره دائمی محصول، «ذخیره محصول» را بزنید.'};
get('inflationScenario').addEventListener('input',preview);
ids.forEach(id=>get(id).addEventListener('input',preview));
get('settlement').addEventListener('change',preview);
get('basis').addEventListener('change',preview);
get('recover').addEventListener('change',preview);
preview();
fetch('./inflation-data.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('no dataset');return r.json()}).then(data=>{
 if(data.status!=='ok'||!Array.isArray(data.observations)||!data.latest||!Number.isFinite(data.latest.annual_pct)||!Number.isInteger(data.latest.year))throw Error('invalid dataset');
 annual=data.latest.annual_pct;
 get('inflationAnnual').textContent=annual.toLocaleString('fa-IR')+'٪';
 get('inflationYear').textContent=String(data.latest.year);
 get('inflationMonthly').textContent=(100*(Math.pow(1+annual/100,1/12)-1)).toFixed(2)+'٪';
 get('inflationApply').disabled=annual<=-100;
 const age=new Date().getUTCFullYear()-data.latest.year;
 get('inflationStatus').textContent=(age>1?'⚠️ داده قدیمی است. ':'')+'مرجع سالانه عمومی؛ آخرین سال موجود: '+data.latest.year+'؛ بررسی: '+String(data.checked_at||'').slice(0,10);
 }).catch(()=>{get('inflationStatus').textContent='داده معتبر خودکار در دسترس نیست. نرخ رشد تولید را دستی تعیین کنید؛ هیچ نرخ فرضی جایگزین نمی‌شود.'});
})();
