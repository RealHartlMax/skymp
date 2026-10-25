import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import './modLoadOrder.scss';

const messages = {
  de: {
    title:'Mod-Ladereihenfolge', intro:'Hochgeladene Spielplugins werden automatisch erkannt. Aktiviere die gewünschten Mods und verschiebe sie in die Reihenfolge, die Server und Launcher verwenden sollen.',
    refresh:'Dateien neu einlesen', save:'Ladereihenfolge speichern', busy:'Wird geladen …', active:'Aktive Mods', available:'Weitere hochgeladene Mods', empty:'Keine weiteren Spielplugins gefunden.',
    search:'Mods nach Namen suchen', enabled:'Aktiv', up:'Nach oben', down:'Nach unten', server:'Spielserver', publication:'Download-Ordner', configured:'Konfiguration',
    directories:'Durchsuchte Ordner', master:'Masterdatei', plugin:'Plugin', dependencies:'Benötigt', readOnly:'Du kannst die Modliste ansehen. Änderungen benötigen ein Administratorkonto mit Konsolenberechtigung.',
    restart:'Gespeichert. Starte den Spielserver neu, damit die neue Reihenfolge aktiv wird und der Launcher das passende Manifest erhält.', pending:'Die gespeicherte Reihenfolge weicht vom laufenden Spielmanifest ab. Starte den Spielserver neu.',
    unsaved:'Ungespeicherte Reihenfolge verwerfen und die Dateien neu einlesen?', changed:'Es gibt ungespeicherte Änderungen.', noPermission:'Du hast keine Berechtigung, die Ressourcen anzusehen.',
    hint:'Spielplugins liegen direkt im Spielserver-Datenordner. ESM-, ESP- und ESL-Dateien im Download-Ordner werden ebenfalls angezeigt. Neue Dateien werden erst durch deine Auswahl aktiviert.',
    missing:'Datei fehlt auf dem Server', invalid:'Plugin-Kopfdaten sind ungültig oder nicht lesbar', duplicate:'Mehrere Dateien haben denselben Namen', publicationOnly:'Für die Aktivierung dieselbe Datei auch im Spielserver-Datenordner ablegen',
    error:'Die Modliste konnte nicht verarbeitet werden. Prüfe die Verbindung und die Dateirechte.', STALE_ORDER:'Konfiguration oder Moddateien wurden inzwischen geändert. Dateien neu einlesen und erneut speichern.', BASE_FIRST:'Skyrim.esm muss an erster Stelle aktiv sein.',
    INVALID_ORDER:'Bitte eine gültige, eindeutige Modliste auswählen.', DUPLICATE_PLUGIN:'Ein Plugin ist mehrfach ausgewählt: ', INVALID_PLUGIN:'Dieses Plugin fehlt oder ist nicht verwendbar: ', SERVER_COPY_REQUIRED:'Dieses Plugin muss auch im Spielserver-Datenordner liegen: ',
    MASTER_ORDER:'Masterdateien müssen vor gewöhnlichen Plugins stehen: ', DEPENDENCY_ORDER:'Ein benötigter Master muss vor seinem Plugin aktiv sein: ', forbidden:'Speichern benötigt eine berechtigte Administratorsitzung.',
  },
  en: {
    title:'Mod load order', intro:'Uploaded game plugins are detected automatically. Enable the mods you want and arrange the order that the server and launcher will use.',
    refresh:'Rescan files', save:'Save load order', busy:'Loading …', active:'Active mods', available:'Other uploaded mods', empty:'No other game plugins found.',
    search:'Search mod names', enabled:'Enabled', up:'Move up', down:'Move down', server:'Game server', publication:'Download directory', configured:'Configuration',
    directories:'Scanned directories', master:'Master file', plugin:'Plugin', dependencies:'Requires', readOnly:'You can view the mod list. Changes require an administrator account with console permission.',
    restart:'Saved. Restart the game server to activate the order and publish the matching launcher manifest.', pending:'The saved order differs from the running game manifest. Restart the game server.',
    unsaved:'Discard unsaved order changes and rescan files?', changed:'There are unsaved changes.', noPermission:'You do not have permission to view resources.',
    hint:'Game plugins belong directly in the game-server data directory. ESM, ESP and ESL files in the download directory are listed too. New files are only enabled when you select them.',
    missing:'File is missing from the server', invalid:'Plugin header is invalid or unreadable', duplicate:'Multiple files share this name', publicationOnly:'Put the same file in the game-server data directory to enable it',
    error:'Unable to process the mod list. Check the connection and file permissions.', STALE_ORDER:'Settings or mod files have changed. Rescan before saving again.', BASE_FIRST:'Skyrim.esm must be enabled first.',
    INVALID_ORDER:'Select a valid, unique mod list.', DUPLICATE_PLUGIN:'A plugin is selected more than once: ', INVALID_PLUGIN:'This plugin is missing or unusable: ', SERVER_COPY_REQUIRED:'This plugin must also exist in the game-server data directory: ',
    MASTER_ORDER:'Master files must precede ordinary plugins: ', DEPENDENCY_ORDER:'A required master must be enabled before its plugin: ', forbidden:'Saving requires an authorized administrator session.',
  },
  ru: {
    title:'Порядок загрузки модов', intro:'Загруженные игровые плагины определяются автоматически. Включите нужные моды и задайте порядок для сервера и лаунчера.',
    refresh:'Перечитать файлы', save:'Сохранить порядок', busy:'Загрузка …', active:'Активные моды', available:'Другие загруженные моды', empty:'Другие игровые плагины не найдены.',
    search:'Поиск модов по имени', enabled:'Включён', up:'Выше', down:'Ниже', server:'Игровой сервер', publication:'Каталог загрузки', configured:'Конфигурация',
    directories:'Проверяемые папки', master:'Мастер-файл', plugin:'Плагин', dependencies:'Требует', readOnly:'Список доступен для просмотра. Для изменений нужен аккаунт администратора с доступом к консоли.',
    restart:'Сохранено. Перезапустите игровой сервер, чтобы применить порядок и опубликовать соответствующий манифест лаунчера.', pending:'Сохранённый порядок отличается от работающего игрового манифеста. Перезапустите игровой сервер.',
    unsaved:'Отменить несохранённые изменения и перечитать файлы?', changed:'Есть несохранённые изменения.', noPermission:'Нет разрешения на просмотр ресурсов.',
    hint:'Игровые плагины должны находиться непосредственно в папке данных игрового сервера. Файлы ESM, ESP и ESL из каталога загрузки также отображаются. Новые файлы включаются только после выбора.',
    missing:'Файл отсутствует на сервере', invalid:'Заголовок плагина повреждён или недоступен', duplicate:'Несколько файлов с таким именем', publicationOnly:'Для включения разместите такой же файл в папке данных игрового сервера',
    error:'Не удалось обработать список модов. Проверьте соединение и права на файлы.', STALE_ORDER:'Настройки или файлы модов изменились. Перечитайте список перед сохранением.', BASE_FIRST:'Skyrim.esm должен быть включён первым.',
    INVALID_ORDER:'Выберите корректный список без повторений.', DUPLICATE_PLUGIN:'Плагин выбран несколько раз: ', INVALID_PLUGIN:'Этот плагин отсутствует или недоступен: ', SERVER_COPY_REQUIRED:'Этот плагин также нужен в папке данных игрового сервера: ',
    MASTER_ORDER:'Мастер-файлы должны идти перед обычными плагинами: ', DEPENDENCY_ORDER:'Нужный мастер-файл должен быть включён до зависимого плагина: ', forbidden:'Для сохранения нужна разрешённая сессия администратора.',
  },
};
type Entry = {name:string; source:'server'|'publication'|'configured'; size:number; masters:string[]; master:boolean; issue?:'missing'|'invalid'|'duplicate'|'publicationOnly'};
type Snapshot = {revision:string; loadOrder:string[]; activeOrder:string[]; restartRequired:boolean; dataDirectory:string; publicationDirectory:string; entries:Entry[]};
type Notice = {code:string; plugin?:string; dependency?:string};
export function ModLoadOrderPanel({canView,canEdit}:{canView:boolean;canEdit:boolean}) {
  const {i18n}=useTranslation(); const language=i18n.language.split('-')[0] as keyof typeof messages;
  const text=messages[language] || messages.en;
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[order,setOrder]=useState<string[]>([]),[busy,setBusy]=useState(false),[search,setSearch]=useState(''),[notice,setNotice]=useState<Notice|null>(null);
  const panel=useRef<HTMLElement|null>(null);
  const dirty=Boolean(snapshot && JSON.stringify(snapshot.loadOrder)!==JSON.stringify(order));
  const endpoint='/api/admin/resources/load-order';
  async function load(signal?:AbortSignal) {
    setBusy(true);setNotice(null);
    try {
      const response=await fetch(endpoint,{credentials:'same-origin',cache:'no-store',signal});
      if(!response.ok)throw Error();const data:Snapshot=await response.json();
      if(!signal?.aborted){setSnapshot(data);setOrder(data.loadOrder);}
    }catch {if(!signal?.aborted)setNotice({code:'error'});}finally{if(!signal?.aborted)setBusy(false);}
  }
  useEffect(()=>{if(!canView)return;const controller=new AbortController();void load(controller.signal);return()=>controller.abort();},[canView]);
  async function save(){
    if(!snapshot||busy||!canEdit)return;setBusy(true);setNotice(null);
    try{
      const response=await fetch(endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:snapshot.revision,loadOrder:order})});
      const data=await response.json();if(!response.ok){setNotice(response.status===403?{code:'forbidden'}:data);return;}
      setSnapshot(data);setOrder(data.loadOrder);setNotice({code:'restart'});
    }catch{setNotice({code:'error'});}finally{setBusy(false);}
  }
  const focusRow=(name:string,action='enabled')=>requestAnimationFrame(()=>{
    const row=panel.current?.querySelector<HTMLElement>('[data-plugin="'+CSS.escape(name)+'"]');
    const button=row?.querySelector<HTMLButtonElement>('button[data-action="'+action+'"]:not(:disabled)');
    (button||row?.querySelector<HTMLInputElement>('input:not(:disabled)'))?.focus();
  });
  const move=(index:number,delta:number)=>{const name=order[index];setOrder(previous=>{const next=[...previous];[next[index],next[index+delta]]=[next[index+delta],next[index]];return next;});focusRow(name,delta<0?'up':'down');};
  const toggle=(entry:Entry)=>{setOrder(previous=>{
    if(previous.some(name=>name.toLowerCase()===entry.name.toLowerCase()))return previous.filter(name=>name.toLowerCase()!==entry.name.toLowerCase());
    const next=[...previous],before=entry.master?next.findIndex(name=>snapshot?.entries.find(value=>value.name.toLowerCase()===name.toLowerCase())?.master===false):-1;
    next.splice(before<0?next.length:before,0,entry.name);return next;
  });focusRow(entry.name);};
  const entries=new Map(snapshot?.entries.map(entry=>[entry.name.toLowerCase(),entry])||[]);
  const selected=new Set(order.map(name=>name.toLowerCase())),matches=(name:string)=>name.toLowerCase().includes(search.trim().toLowerCase());
  function row(entry:Entry,index:number|null){
    const active=index!==null;
    const occurrence=active?order.slice(0,index!).filter(name=>name.toLowerCase()===entry.name.toLowerCase()).length:0;
    return <li key={entry.name+':'+occurrence} className="mod-load-order__row" data-plugin={entry.name}>
      <label><input type="checkbox" checked={active} disabled={busy||!canEdit||!active&&Boolean(entry.issue)} onChange={()=>toggle(entry)} aria-label={text.enabled+': '+entry.name}/>
        <span><strong>{entry.name}</strong><small>{entry.master?text.master:text.plugin} · {text[entry.source]} · {(entry.size/1024).toLocaleString(language,{maximumFractionDigits:1})} KiB</small>
          {entry.masters.length>0&&<small>{text.dependencies}: {entry.masters.join(', ')}</small>}{entry.issue&&<small className="mod-load-order__issue">{text[entry.issue]}</small>}</span></label>
      {active&&<div className="mod-load-order__moves"><span aria-label={text.active}>{index!+1}</span>
        <button type="button" data-action="up" disabled={busy||!canEdit||index===0} aria-label={text.up+': '+entry.name} onClick={()=>move(index!,-1)}>↑</button>
        <button type="button" data-action="down" disabled={busy||!canEdit||index===order.length-1} aria-label={text.down+': '+entry.name} onClick={()=>move(index!,1)}>↓</button></div>}
    </li>;
  }
  const noticeText=notice ? ((text as Record<string,string>)[notice.code]||text.error)+(notice.plugin?' '+notice.plugin:'')+(notice.dependency?' → '+notice.dependency:'') : '';
  return <section className="mod-load-order" data-testid="mod-load-order" ref={panel}>
    <header><div><h2>{text.title}</h2><p>{text.intro}</p></div><button type="button" disabled={busy||!canView} onClick={()=>{if(!dirty||window.confirm(text.unsaved))void load();}}>{text.refresh}</button></header>
    {!canView?<p>{text.noPermission}</p>:<>
      {!canEdit&&<p>{text.readOnly}</p>}{notice&&<p className="mod-load-order__notice" role={notice.code==='restart'?'status':'alert'}>{noticeText}</p>}
      {busy&&!snapshot&&<p role="status">{text.busy}</p>}
      {snapshot&&<><p className="mod-load-order__directories">{text.directories}: <code>{snapshot.dataDirectory}</code> · <code>{snapshot.publicationDirectory}</code></p><p>{text.hint}</p>
        {snapshot.restartRequired&&notice?.code!=='restart'&&<p className="mod-load-order__notice" role="status">{text.pending}</p>}
        <label className="mod-load-order__search">{text.search}<input type="search" value={search} onChange={event=>setSearch(event.target.value)}/></label>
        <h3>{text.active} <span>({order.length})</span></h3><ol className="mod-load-order__list">{order.map((name,index)=>{const entry=entries.get(name.toLowerCase());return entry&&matches(name)?row(entry,index):null;})}</ol>
        <h3>{text.available}</h3><ul className="mod-load-order__list">{snapshot.entries.filter(entry=>!selected.has(entry.name.toLowerCase())&&matches(entry.name)).map(entry=>row(entry,null))}</ul>
        {!snapshot.entries.some(entry=>!selected.has(entry.name.toLowerCase())&&matches(entry.name))&&<p>{text.empty}</p>}
        <footer><button type="button" className="mod-load-order__save" disabled={!dirty||busy||!canEdit} onClick={()=>void save()}>{busy?text.busy:text.save}</button>{dirty&&<span role="status">{text.changed}</span>}</footer>
      </>}
    </>}
  </section>;
}
