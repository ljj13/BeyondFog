import type { Page } from '@playwright/test';
export async function chooseFolder(page:Page,label:string,name:string){
  await page.getByRole('combobox',{name:label,exact:true}).click();
  await page.getByRole('listbox',{name:label,exact:true}).getByRole('option',{name,exact:true}).click();
}
