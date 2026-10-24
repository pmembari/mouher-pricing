'use strict';
const $=id=>document.getElementById(id);
const ids=['name','sku','basis','cost','usd','fx','extra','margin','fee','vat','recover','settlement','growth','round','actual'];
const num=id=>Math.max(0,Number($(id).value)||0);
const fmt=n=>Number.isFinite(n)?Math.round(n).toLocaleString('fa-IR'):'—';
const periods={now:[[0,1]],m1:[[1,1]],m2:[[2,1]],split2:[[1,.5],[2,.5]],split4:[[1,.25],[2,.25],[3,.25],[4,.25]]};
const key='mouher-pricing-products-v1';let result;let currentPhoto='';
function previewPhoto(){const im=$('photoPreview');im.hidden=!currentPhoto;im.src=currentPhoto||'';$('removePhoto').hidden=!currentPhoto;}
$('photo').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;if(!file.type.startsWith('image/')||file.size>15*1024*1024){alert('لطفاً عکس کمتر از ۱۵ مگابایت انتخاب کنید.');event.target.value='';return;}try{const bitmap=await createImageBitmap(file);const scale=Math.min(1,440/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);currentPhoto=canvas.toDataURL('image/jpeg',.68);bitmap.close?.();previewPhoto();}catch{alert('خواندن این عکس ممکن نیست. یک فایل JPEG یا PNG انتخاب کنید.')}event.target.value=''});
$('removePhoto').onclick=()=>{currentPhoto='';previewPhoto()};
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

function priceFor(d){
 const n=k=>Math.max(0,Number(d[k])||0);
 const replacement=d.basis==='usd'?n('usd')*n('fx'):n('cost');
 const total=replacement+n('extra'), margin=n('margin')/100,fee=n('fee')/100;
 const retained=1-fee*(1+(d.recover?0:n('vat')/100));
 const g=n('growth')/100, stages=periods[d.settlement]||periods.now;
 const df=stages.reduce((sum,[months,part])=>sum+part/Math.pow(1+g,months),0);
 const step=n('round')||10000;
 const up=x=>Math.ceil(x/step)*step;
 const valid=replacement>0&&margin>=0&&margin<1&&retained>0&&String(d.fee||'').trim()!==''&&String(d.growth||'').trim()!=='';
 const cash=valid?up(total/(1-margin)):null;
 const bnpl=valid?up(total/(1-margin)/retained/df):null;
 const actual=String(d.actual||'').trim()?n('actual'):cash;
 const pv=valid?actual*retained*df:null;
 return {valid,cash,bnpl,actual,total,pv,contribution:valid?pv-total:null};
}

const snapshot=()=>({...Object.fromEntries(ids.map(id=>[id,$(id).type==='checkbox'?$(id).checked:$(id).value])),photo:currentPhoto});
function load(s){currentPhoto=typeof s.photo==='string'&&s.photo.startsWith('data:image/jpeg;base64,')?s.photo:'';previewPhoto();ids.forEach(id=>{if(s[id]!==undefined){if($(id).type==='checkbox')$(id).checked=!!s[id];else $(id).value=String(s[id])}});calculate()}
function saved(){try{const list=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(list)?list:[]}catch{return []}}
function persist(items){localStorage.setItem(key,JSON.stringify(items));render()}
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
  pricing.textContent=p.valid?'نقدی: '+fmt(p.cash)+' | اقساط نظری: '+fmt(p.bnpl)+' تومان':'⚠ اطلاعات لازم برای قیمت‌گذاری کامل نیست';
  pricing.style.color=p.valid?'#176344':'#a05b20';pricing.style.fontWeight='bold';title.append(b,desc,pricing);if(typeof d.photo==='string'&&d.photo.startsWith('data:image/jpeg;base64,')){const thumb=document.createElement('img');thumb.src=d.photo;thumb.alt='عکس محصول';thumb.width=70;thumb.height=70;thumb.style.cssText='width:70px;height:70px;object-fit:cover;border-radius:12px';row.append(thumb);const share=document.createElement('button');share.textContent='اشتراک عکس';share.onclick=()=>shareProductPhoto(d.photo,d.sku||d.name||'product');title.append(share)}
  open.textContent='ویرایش';open.onclick=()=>{load(d);show('calculator');window.scrollTo(0,0)};
  del.textContent='حذف';del.onclick=()=>{if(confirm('این محصول حذف شود؟'))persist(saved().filter((_,j)=>j!==i))};
  const buttons=document.createElement('div');buttons.style.display='flex';buttons.style.gap='6px';buttons.append(open,del);
  row.append(title,buttons);container.append(row)
 })
}

ids.forEach(id=>{['input','change'].forEach(event=>$(id).addEventListener(event,calculate))});
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>show(b.dataset.tab));
$('save').onclick=()=>{if(!$('name').value.trim())return alert('نام محصول را وارد کنید.');const items=saved(),data=snapshot(),at=new Date().toISOString();const same=items.findIndex(x=>data.sku&&x.data.sku===data.sku);if(same>=0){if(!confirm('محصول دارای همین کد جایگزین شود؟'))return;items[same]={data,at}}else items.unshift({data,at});try{persist(items);alert('محصول در همین دستگاه ذخیره شد.')}catch{alert('ذخیره در این مرورگر ممکن نیست.')}};
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
 const columns=['نام محصول','کد کالا','مبنای هزینه','هزینه جایگزینی تومان','هزینه مستقیم کل تومان','حاشیه هدف درصد','کارمزد درصد','مالیات کارمزد درصد','مالیات قابل بازیافت','برنامه تسویه','رشد ماهانه درصد','قیمت نقدی پیشنهادی تومان','قیمت نظری اقساطی تومان','قیمت فروش بررسی شده تومان','ارزش اقتصادی وجوه تومان','مشارکت اقتصادی تومان','وضعیت','آخرین ذخیره'];
 const records=saved().map(({data:d,at})=>{const p=priceFor(d);return [d.name||'',d.sku||'',d.basis||'toman',d.basis==='usd'?(Number(d.usd)||0)*(Number(d.fx)||0):d.cost||0,p.total,d.margin||'',d.fee||'',d.vat||'',d.recover?'بله':'خیر',d.settlement||'',d.growth||'',p.valid?p.cash:'',p.valid?p.bnpl:'',p.valid?p.actual:'',p.valid?Math.round(p.pv):'',p.valid?Math.round(p.contribution):'',p.valid?'آماده بررسی':'ناقص',at];
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
render();calculate();if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));