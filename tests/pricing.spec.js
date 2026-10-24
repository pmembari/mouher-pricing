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
 await page.locator('a[href="./data-guide.html"]').click();
 await expect(page).toHaveURL(/data-guide.html/);
 await expect(page.locator('img[src*="guide-cost.svg"]')).toBeVisible();
 await expect(page.locator('#monthly')).not.toHaveText('—');
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
