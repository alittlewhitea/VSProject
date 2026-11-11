import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {projectLoader} from './load-project-ts.mjs';
const load=projectLoader(),{locales}=load('src/i18n/routing.ts'),{resolveStudioMessages}=load('src/lib/studio-message-catalog.ts'),{creditShopMessages}=load('src/lib/credit-shop-messages.ts');
const check=process.argv.includes('--check');let count=0;
for(const locale of locales)for(const [section,messages] of [['studio',resolveStudioMessages(locale)],['credit-shop',creditShopMessages[locale]]]) {
 const directory=`messages/${section}`,file=`${directory}/${locale}.json`,text=JSON.stringify(Object.fromEntries(Object.entries(messages).sort(([a],[b])=>a.localeCompare(b,'en'))),null,2)+'\n';
 if(check){if(!existsSync(file)||readFileSync(file,'utf8')!==text)throw new Error(`${file} is stale. Run npm run generate:studio-messages.`);}
 else{mkdirSync(directory,{recursive:true});writeFileSync(file,text);}
 count++;
}
console.log(`${check?'Verified':'Generated'} ${count} locale-specific Studio/CreditShop dictionaries with original override and fallback order.`);
