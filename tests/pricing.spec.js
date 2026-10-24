const {test,expect}=require('@playwright/test');
const set=async(page,id,value)=>page.locator('#'+id).fill(String(value));
async function fillValid(page){
 await set(page,'name','پیراهن موهر');
 await set(page,'sku','MH-SHIRT-001');
 await set(page,'cost',1800000);
 await set(page,'extra',150000);
 await set(page,'margin',30);
 await set(page,'fee',13);
 await set(page,'vat',10);
 await set(page,'growth',8);
 await page.locator('#settlement').selectOption('m2');
}
async function save(page){
 page.once('dialog',d=>d.accept());
 await page.locator('#save').click();
}
test.beforeEach(async({page})=>{await page.goto('/');await page.evaluate(()=>localStorage.clear());await page.reload()});
test('navigation: calculator, products and guide tabs are interactive',async({page})=>{
 await page.locator('[data-tab="products"]').click();
 await expect(page.locator('#products')).toHaveClass(/active/);
 await expect(page.locator('#calculator')).not.toHaveClass(/active/);
 await page.locator('[data-tab="guide"]').click();
 await expect(page.locator('#guide')).toHaveClass(/active/);
 await page.locator('[data-tab="calculator"]').click();
 await expect(page.locator('#calculator')).toHaveClass(/active/);
});
test('cash and BNPL pricing use replacement cost, commission, VAT and delay',async({page})=>{
 await fillValid(page);
 await expect(page.locator('#cash')).toContainText('۲٬۷۹۰٬۰۰۰');
 await expect(page.locator('#bnpl')).toContainText('۳٬۸۰۰٬۰۰۰');
 await expect(page.locator('#scheduleBody tr')).toHaveCount(1);
 await page.locator('#settlement').selectOption('split4');
 await expect(page.locator('#scheduleBody tr')).toHaveCount(4);
});
test('margin is not markup; USD cost uses supplied exchange rate',async({page})=>{
 await page.locator('#basis').selectOption('usd');
 await set(page,'usd',10);await set(page,'fx',100000);await set(page,'extra',0);
 await set(page,'margin',30);await set(page,'fee',0);await set(page,'growth',0);
 await page.locator('#settlement').selectOption('now');
 await expect(page.locator('#cash')).toContainText('۱٬۴۳۰٬۰۰۰');
 await expect(page.locator('#bnpl')).toContainText('۱٬۴۳۰٬۰۰۰');
});
test('warnings appear for missing contractual or inflation inputs',async({page})=>{
 await expect(page.locator('#missing')).toContainText('درصد کارمزد قراردادی');
 await expect(page.locator('#missing')).toContainText('برآورد رشد هزینه تأمین');
 await fillValid(page);
 await expect(page.locator('#missing')).toBeHidden();
});
test('recoverable VAT reduces commission cost',async({page})=>{
 await fillValid(page);const before=await page.locator('#bnpl').innerText();
 await page.locator('#recover').check();
 const after=await page.locator('#bnpl').innerText();
 expect(before).not.toBe(after);
});
test('save two products, search, edit, delete, and persist after refresh',async({page})=>{
 await fillValid(page);await save(page);
 await set(page,'name','مانتو موهر');await set(page,'sku','MH-COAT-002');await save(page);
 await page.reload();await page.locator('[data-tab="products"]').click();
 await expect(page.locator('#productList .saved')).toHaveCount(2);
 await set(page,'searchProducts','MH-SHIRT');
 await expect(page.locator('#productList .saved')).toHaveCount(1);
 await page.locator('#productList button').first().click();
 await expect(page.locator('#name')).toHaveValue('پیراهن موهر');
 await page.locator('[data-tab="products"]').click();
 await set(page,'searchProducts','MH-SHIRT');
 page.once('dialog',d=>d.accept());
 await page.locator('#productList button').nth(1).click();
 await expect(page.locator('#productList .saved')).toHaveCount(0);
 await set(page,'searchProducts','');
 await expect(page.locator('#productList .saved')).toHaveCount(1);
});
test('CSV exports calculated prices, not only raw inputs',async({page})=>{
 await fillValid(page);await save(page);await page.locator('[data-tab="products"]').click();
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#csv').click()]);
 expect(download.suggestedFilename()).toBe('mouher-price-list.csv');
 const fs=require('node:fs');const data=fs.readFileSync(await download.path(),'utf8');
 expect(data).toContain('قیمت نقدی پیشنهادی تومان');expect(data).toContain('2790000');expect(data).toContain('3800000');
});
test('JSON backup exports saved products and does not auto-upload',async({page})=>{
 await fillValid(page);await save(page);await page.locator('[data-tab="products"]').click();
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#export').click()]);
 const fs=require('node:fs');const json=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
 expect(json.version).toBe(1);expect(json.products[0].data.sku).toBe('MH-SHIRT-001');
});
test('illustrated instructions and inflation growth guide load',async({page})=>{
 await page.locator('[data-tab="guide"]').click();
 const guide=page.frameLocator('#guideFrame');
 await expect(guide.locator('img[src*="guide-cost.svg"]')).toBeVisible();
 await expect(guide.locator('#monthly')).not.toHaveText('—');
 await expect(guide.locator('#lesson9')).toBeVisible();
});
test('separate devices do not share stored products',async({browser})=>{
 const a=await browser.newContext(),b=await browser.newContext();
 try{
  const pa=await a.newPage(),pb=await b.newPage();
  await pa.goto('/');await pb.goto('/');
  await set(pa,'name','فقط دستگاه الف');await set(pa,'sku','DEVICE-A');await set(pa,'fee',10);await set(pa,'growth',5);await save(pa);
  await pb.locator('[data-tab="products"]').click();
  await expect(pb.locator('#productList')).toContainText('هنوز محصولی ذخیره نشده است.');
  await pa.locator('[data-tab="products"]').click();
  await expect(pa.locator('#productList')).toContainText('فقط دستگاه الف');
 }finally{await a.close();await b.close()}
});

test('Google Drive CSV share passes calculated file to native share sheet without uploading',async({page})=>{
 await fillValid(page);await save(page);
 await page.locator('[data-tab="products"]').click();
 await page.evaluate(()=>{
  window.__shared=[];
  Object.defineProperty(navigator,'canShare',{configurable:true,value:({files})=>files.length===1});
  Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{
   const file=data.files[0];
   window.__shared.push({name:file.name,type:file.type,content:await file.text()});
  }});
 });
 await page.locator('#shareCsv').click();
 await expect.poll(()=>page.evaluate(()=>window.__shared.length)).toBe(1);
 const shared=await page.evaluate(()=>window.__shared[0]);
 expect(shared.name).toBe('mouher-price-list.csv');
 expect(shared.content).toContain('MH-SHIRT-001');
 expect(shared.content).toContain('2790000');
});
test('Google Drive JSON share contains product backup, not other devices data',async({page})=>{
 await fillValid(page);await save(page);
 await page.locator('[data-tab="products"]').click();
 await page.evaluate(()=>{
  window.__shared=[];
  Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
  Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{
   window.__shared.push(JSON.parse(await data.files[0].text()));
  }});
 });
 await page.locator('#shareBackup').click();
 await expect.poll(()=>page.evaluate(()=>window.__shared.length)).toBe(1);
 const shared=await page.evaluate(()=>window.__shared[0]);
 expect(shared.products).toHaveLength(1);
 expect(shared.products[0].data.sku).toBe('MH-SHIRT-001');
});
test('share fallback downloads file if native sharing unavailable',async({page})=>{
 await fillValid(page);await save(page);
 await page.locator('[data-tab="products"]').click();
 await page.evaluate(()=>{
  Object.defineProperty(navigator,'canShare',{configurable:true,value:undefined});
  Object.defineProperty(navigator,'share',{configurable:true,value:undefined});
 });
 page.once('dialog',d=>d.accept());
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#shareCsv').click()]);
 expect(download.suggestedFilename()).toBe('mouher-price-list.csv');
});

test('product image attaches, previews, persists, and stays isolated from another device',async({page,browser})=>{
 await fillValid(page);
 const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+QkioAAAAASUVORK5CYII=','base64');
 await page.locator('#photo').setInputFiles({name:'test-product.png',mimeType:'image/png',buffer:image});
 await expect(page.locator('#photoPreview')).toBeVisible();
 await save(page);await page.reload();await page.locator('[data-tab="products"]').click();
 await expect(page.locator('#productList img')).toHaveCount(1);
 await page.locator('#productList button').first().click();
 await expect(page.locator('#photoPreview')).toBeVisible();
 const other=await browser.newContext();
 try{const p=await other.newPage();await p.goto('/');await p.locator('[data-tab="products"]').click();await expect(p.locator('#productList img')).toHaveCount(0)}finally{await other.close()}
});

test('product photo is shared as image file, never uploaded to GitHub',async({page})=>{
 await fillValid(page);
 const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+QkioAAAAASUVORK5CYII=','base64');
 await page.locator('#photo').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:image});
 await expect(page.locator('#photoPreview')).toBeVisible();
 await page.evaluate(()=>{
  window.__shared=[];
  Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
  Object.defineProperty(navigator,'share',{configurable:true,value:async data=>window.__shared.push({name:data.files[0].name,type:data.files[0].type})});
 });
 await page.locator('#sharePhoto').click();
 await expect.poll(()=>page.evaluate(()=>window.__shared.length)).toBe(1);
 expect(await page.evaluate(()=>window.__shared[0].type)).toBe('image/jpeg');
 expect(await page.locator('#publicPhoto').count()).toBe(0);
});

test('shop name defaults to Mouher and persists locally per device',async({page,browser})=>{
 await page.locator('[data-tab="products"]').click();
 await expect(page.locator('#shopName')).toHaveValue('Mouher');
 await page.locator('#shopName').fill('Rose Boutique');
 await page.locator('#shopName').dispatchEvent('change');
 await page.reload();await page.locator('[data-tab="products"]').click();
 await expect(page.locator('#shopName')).toHaveValue('Rose Boutique');
 const other=await browser.newContext();
 try{const p=await other.newPage();await p.goto('/');await p.locator('[data-tab="products"]').click();await expect(p.locator('#shopName')).toHaveValue('Mouher')}finally{await other.close()}
});


test('security: malicious product names render as text, not executable HTML',async({page})=>{
 const payload='<img src=x onerror="window.__pwned=true">';
 await page.evaluate(p=>{
  localStorage.setItem('mouher-pricing-products-v1',JSON.stringify([{data:{name:p,sku:'S1',basis:'toman',cost:'1000',margin:'30',fee:'10',growth:'0',settlement:'now'},at:new Date().toISOString()}]));
 },payload);
 await page.reload();await page.locator('[data-tab="products"]').click();
 await expect(page.locator('#productList')).toContainText(payload);
 expect(await page.evaluate(()=>window.__pwned===true)).toBe(false);
});
test('security: spreadsheet formulas are neutralized in exported CSV',async({page})=>{
 await page.locator('#name').fill('=HYPERLINK("https://evil.example","CLICK")');
 await page.locator('#sku').fill('+SUM(1,2)');
 await page.locator('#fee').fill('5');await page.locator('#growth').fill('0');
 await save(page);await page.locator('[data-tab="products"]').click();
 const [file]=await Promise.all([page.waitForEvent('download'),page.locator('#csv').click()]);
 const csv=require('node:fs').readFileSync(await file.path(),'utf8');
 expect(csv).toContain('"\'=HYPERLINK(');
 expect(csv).toContain('"\'+SUM(1,2)"');
});
test('security: malformed and oversized JSON imports preserve existing products',async({page})=>{
 await fillValid(page);await save(page);await page.locator('[data-tab="products"]').click();
 const invalid={version:1,products:[{data:{name:'bad',photo:'data:text/html;base64,PHNjcmlwdD4='},at:new Date().toISOString()}]};
 page.once('dialog',d=>d.accept());
 await page.locator('#import').setInputFiles({name:'malicious.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalid))});
 await expect(page.locator('#productList .saved')).toHaveCount(1);
 await expect(page.locator('#productList')).toContainText('پیراهن موهر');
});

test('simple Google Drive onboarding has sign-in button and no developer credential field',async({page})=>{
 await page.locator('[data-tab="products"]').click();
 await expect(page.locator('#driveCsv')).toBeVisible();
 await expect(page.locator('#googleClientId')).toHaveCount(0);
 await page.locator('#driveCsv').click();
 await expect(page.locator('#driveStatus')).toContainText('در حال درخواست اجازه دسترسی محدود');
});

test('Google authentication uses temporary browser memory and offers session disconnect',async({page})=>{
 await page.locator('[data-tab="products"]').click();
 await expect(page.locator('#driveDisconnect')).toBeHidden();
 await page.evaluate(()=>{
  window.MOUHER_GOOGLE_CLIENT_ID='12345-example.apps.googleusercontent.com';
  window.google={accounts:{oauth2:{
   initTokenClient:({callback})=>({requestAccessToken:()=>callback({access_token:'fake-test-token',expires_in:3600})}),
   revoke:()=>{}
  }}};
  window.fetch=async (url,options)=>{
   const path=String(url);
   if(path.includes('/drive/v3/files?')&&(!options||!options.method))return new Response(JSON.stringify({files:[{id:'folder-test'}]}),{status:200,headers:{'Content-Type':'application/json'}});
   return new Response(JSON.stringify({id:'test-file'}),{status:200,headers:{'Content-Type':'application/json'}});
  };
 });
 page.once('dialog',dialog=>dialog.dismiss());
 await page.locator('#driveCsv').click();
 await expect(page.locator('#driveDisconnect')).toBeVisible();
 expect(await page.evaluate(()=>Object.values(localStorage).join('|').includes('fake-test-token'))).toBe(false);
 await page.locator('#driveDisconnect').click();
 await expect(page.locator('#driveDisconnect')).toBeHidden();
});
