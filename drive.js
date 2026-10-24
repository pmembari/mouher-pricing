'use strict';
(()=>{
 const $=id=>document.getElementById(id);
 const status=(message)=>{$('driveStatus').textContent=message};
 const configKey='mouher-google-oauth-client-id-v1';
 $('googleClientId').value=localStorage.getItem(configKey)||'';
 $('googleClientId').addEventListener('change',()=>localStorage.setItem(configKey,$('googleClientId').value.trim()));
 const shopKey='mouher-shop-name-v1';
 $('shopName').value=localStorage.getItem(shopKey)||'Mouher';
 $('shopName').addEventListener('change',()=>localStorage.setItem(shopKey,$('shopName').value.trim()||'Mouher'));
 function selectedShop(){const name=$('shopName').value.trim().replace(/[\\/\x00-\x1f]/g,' ').slice(0,70)||'Mouher';localStorage.setItem(shopKey,name);return name;}
 let token=null,expires=0;
 function authenticate(){
  return new Promise((resolve,reject)=>{
   const clientId=$('googleClientId').value.trim();
   if(!/^[\w-]+\.apps\.googleusercontent\.com$/.test(clientId))return reject(Error('ابتدا OAuth Client ID معتبر را وارد کنید.'));
   if(!window.google?.accounts?.oauth2)return reject(Error('سرویس ورود گوگل بارگذاری نشد. اتصال اینترنت را بررسی کنید.'));
   if(token&&Date.now()<expires-60000)return resolve(token);
   const client=google.accounts.oauth2.initTokenClient({
    client_id:clientId,scope:'https://www.googleapis.com/auth/drive.file',
    callback:response=>{
     if(response.error)return reject(Error(response.error));
     token=response.access_token;
     expires=Date.now()+(Number(response.expires_in)||3500)*1000;
     resolve(token);
    },
    error_callback:()=>reject(Error('پنجره تأیید گوگل بسته یا مسدود شد. در Safari سایت را مستقیم باز کنید.'))
   });
   client.requestAccessToken({prompt:'consent'});
  });
 }
 async function request(url,options={}){
  const headers=new Headers(options.headers||{});
  headers.set('Authorization','Bearer '+token);
  const res=await fetch(url,{...options,headers,cache:'no-store'});
  if(!res.ok){
   let detail='';
   try{detail=(await res.json()).error?.message||''}catch{}
   throw Error('Google Drive API '+res.status+(detail?': '+detail:''));
  }
  return res.status===204?{}:res.json();
 }
 const base='https://www.googleapis.com/drive/v3/files';
 const esc=value=>String(value).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
 async function folder(name,parent){
  const q=["name = '"+esc(name)+"'","mimeType = 'application/vnd.google-apps.folder'","trashed = false", "'"+esc(parent)+"' in parents"].join(' and ');
  const params=new URLSearchParams({q,fields:'nextPageToken,files(id,name)',page_size:'100'});
  // Google Drive parameter is pageSize, not page_size.
  params.delete('page_size');params.set('pageSize','100');
  const found=await request(base+'?'+params);
  if(found.files?.length)return found.files[0].id;
  const created=await request(base+'?fields=id',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,mimeType:'application/vnd.google-apps.folder',parents:[parent]})});
  return created.id;
 }
 async function upload(parent,filename,blob,mime){
  const meta=await request(base+'?fields=id,webViewLink',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:filename,parents:[parent],mimeType:mime})});
  try{
   await request('https://www.googleapis.com/upload/drive/v3/files/'+encodeURIComponent(meta.id)+'?uploadType=media&fields=id',{method:'PATCH',headers:{'Content-Type':mime},body:blob});
  }catch(error){throw Error(filename+': '+error.message)}
  return meta.id;
 }
 function folderDate(){
  const d=new Date();
  // Device-local Gregorian date; name components are unambiguous.
  return [String(d.getFullYear()),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')];
 }
 async function run(mode){
  const button=$('drive'+mode);
  button.disabled=true;
  try{
   status('در حال درخواست اجازه دسترسی محدود به Google Drive…');
   await authenticate();
   const shop=selectedShop();
   let items=[];
   const products=saved();
   if(mode==='Csv'){
    const csv=exportCsv('return');
    items=[['mouher-price-list.csv',new Blob([csv],{type:'text/csv;charset=utf-8'}),'text/csv']];
   }else if(mode==='Backup'){
    items=[['mouher-pricing-backup.json',new Blob([JSON.stringify({version:1,products},null,2)],{type:'application/json'}),'application/json']];
   }else{
    for(let i=0;i<products.length;i++){
     const d=products[i].data,photo=d.photo;
     if(typeof photo!=='string'||!photo.startsWith('data:image/jpeg;base64,'))continue;
     const bytes=Uint8Array.from(atob(photo.split(',')[1]),c=>c.charCodeAt(0));
     const id=(d.sku||'product-'+(i+1)).replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,70);
     items.push([id+'.jpg',new Blob([bytes],{type:'image/jpeg'}),'image/jpeg']);
    }
   }
   if(!items.length){status('موردی برای ارسال وجود ندارد. ابتدا محصول یا عکس ذخیره کنید.');return}
   if(!confirm('تعداد '+items.length+' فایل در Google Drive شما، پوشه '+shop+'/'+folderDate().join('/')+' بارگذاری شود؟')){status('ارسال لغو شد.');return}
   status('در حال آماده‌سازی پوشه تاریخ‌دار…');
   let parent='root';
   for(const name of [shop,...folderDate()])parent=await folder(name,parent);
   let count=0;
   for(const [name,blob,mime] of items){status('در حال بارگذاری '+(count+1)+' از '+items.length+'…');await upload(parent,name,blob,mime);count++}
   status('✅ '+count+' فایل با موفقیت در پوشه '+shop+'/'+folderDate().join('/')+' ذخیره شد.');
  }catch(error){status('⚠️ '+error.message)}finally{button.disabled=false}
 }
 ['Csv','Backup','Images'].forEach(mode=>$('drive'+mode).addEventListener('click',()=>run(mode)));
})();
