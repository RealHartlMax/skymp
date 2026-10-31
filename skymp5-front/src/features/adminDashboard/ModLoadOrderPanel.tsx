import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import './modLoadOrder.scss';

const messages = {
  de: {
    modFolder:'Mod-Ordner', modFolders:'Mod-Ordner in data/mods', modFoldersHint:'Lege jede Mod in einen eigenen Ordner, zum Beispiel data/mods/RaceMenu. Bei gleichen Dateien gewinnt der weiter unten stehende Ordner. Spieler erhalten die Dateien im normalen Data-Ordner.', noModFolders:'Noch keine Mod-Ordner vorhanden.', inactive:'Inaktiv, weil kein Plugin dieses Ordners aktiviert ist', skseAllow:'SKSE-DLLs an Spieler verteilen', skseWarning:'DLLs sind ausführbarer Code. Aktiviere das nur für Mods, denen du vertraust. Spieler müssen jede DLL im Launcher bestätigen.', skseVersion:'Skyrim-Version der DLLs', conflicts:'Dateikonflikte', skippedFiles:'Nicht verteilte Dateien', replacedBy:'ersetzt durch', INVALID_GAME_VERSION:'Bitte eine gültige Skyrim-Version angeben, zum Beispiel 1.6.1170.0.',
    title:'Mod-Ladereihenfolge', intro:'Zusätzliche Spielmods werden automatisch erkannt. Aktiviere die gewünschten Mods und verschiebe sie in die Reihenfolge, die Server und Launcher verwenden sollen.',
    baseFiles:'Die fünf benötigten Spieldateien bleiben automatisch vor allen zusätzlichen Mods geladen. Sie sind kein Teil der auswählbaren Modliste.',
    refresh:'Dateien neu einlesen', save:'Ladereihenfolge speichern', busy:'Wird geladen …', active:'Aktive Mods', available:'Weitere hochgeladene Mods', empty:'Keine weiteren Spielplugins gefunden.',
    search:'Mods nach Namen suchen', enabled:'Aktiv', up:'Nach oben', down:'Nach unten', server:'Spielserver', mod:'Mod-Ordner', configured:'Konfiguration',
    directories:'Durchsuchte Ordner', master:'Masterdatei', plugin:'Plugin', dependencies:'Benötigt', readOnly:'Du kannst die Modliste ansehen. Änderungen benötigen ein Administratorkonto mit Konsolenberechtigung.',
    restart:'Gespeichert. Starte den Spielserver neu, damit die neue Reihenfolge aktiv wird und der Launcher das passende Manifest erhält.', pending:'Die gespeicherte Reihenfolge weicht vom laufenden Spielmanifest ab. Starte den Spielserver neu.',
    unsaved:'Ungespeicherte Reihenfolge verwerfen und die Dateien neu einlesen?', changed:'Es gibt ungespeicherte Änderungen.', noPermission:'Du hast keine Berechtigung, die Ressourcen anzusehen.',
    hint:'Spielplugins liegen in data/mods/<Mod> oder direkt im Datenordner. Neue Dateien werden erst durch deine Auswahl aktiviert.',
    missing:'Datei fehlt auf dem Server', invalid:'Plugin-Kopfdaten sind ungültig oder nicht lesbar', duplicate:'Mehrere Dateien haben denselben Namen',
    error:'Die Modliste konnte nicht verarbeitet werden. Prüfe die Verbindung und die Dateirechte.', STALE_ORDER:'Konfiguration oder Moddateien wurden inzwischen geändert. Dateien neu einlesen und erneut speichern.', BASE_FIRST:'Skyrim.esm muss an erster Stelle aktiv sein.',
    INVALID_ORDER:'Bitte eine gültige, eindeutige Modliste auswählen.', DUPLICATE_PLUGIN:'Ein Plugin ist mehrfach ausgewählt: ', INVALID_PLUGIN:'Dieses Plugin fehlt oder ist nicht verwendbar: ',
    MASTER_ORDER:'Masterdateien müssen vor gewöhnlichen Plugins stehen: ', DEPENDENCY_ORDER:'Ein benötigter Master muss vor seinem Plugin aktiv sein: ', forbidden:'Speichern benötigt eine berechtigte Administratorsitzung.',
  },
  en: {
    modFolder:'Mod folder', modFolders:'Mod folders in data/mods', modFoldersHint:'Put each mod in its own folder, for example data/mods/RaceMenu. For identical files, the folder further down wins. Players receive the files in the normal Data folder.', noModFolders:'No mod folders yet.', inactive:'Inactive because no plugin from this folder is enabled', skseAllow:'Distribute SKSE DLLs to players', skseWarning:'DLLs are executable code. Enable this only for mods you trust. Players must confirm each DLL in the launcher.', skseVersion:'Skyrim version of the DLLs', conflicts:'File conflicts', skippedFiles:'Files not distributed', replacedBy:'replaced by', INVALID_GAME_VERSION:'Enter a valid Skyrim version, for example 1.6.1170.0.',
    title:'Mod load order', intro:'Additional game mods are detected automatically. Enable the mods you want and arrange the order that the server and launcher will use.',
    baseFiles:'The five required game files are always loaded before additional mods. They are not part of the selectable mod list.',
    refresh:'Rescan files', save:'Save load order', busy:'Loading …', active:'Active mods', available:'Other uploaded mods', empty:'No other game plugins found.',
    search:'Search mod names', enabled:'Enabled', up:'Move up', down:'Move down', server:'Game server', mod:'Mod folder', configured:'Configuration',
    directories:'Scanned directories', master:'Master file', plugin:'Plugin', dependencies:'Requires', readOnly:'You can view the mod list. Changes require an administrator account with console permission.',
    restart:'Saved. Restart the game server to activate the order and publish the matching launcher manifest.', pending:'The saved order differs from the running game manifest. Restart the game server.',
    unsaved:'Discard unsaved order changes and rescan files?', changed:'There are unsaved changes.', noPermission:'You do not have permission to view resources.',
    hint:'Game plugins belong in data/mods/<mod> or directly in the data directory. New files are only enabled when you select them.',
    missing:'File is missing from the server', invalid:'Plugin header is invalid or unreadable', duplicate:'Multiple files share this name',
    error:'Unable to process the mod list. Check the connection and file permissions.', STALE_ORDER:'Settings or mod files have changed. Rescan before saving again.', BASE_FIRST:'Skyrim.esm must be enabled first.',
    INVALID_ORDER:'Select a valid, unique mod list.', DUPLICATE_PLUGIN:'A plugin is selected more than once: ', INVALID_PLUGIN:'This plugin is missing or unusable: ',
    MASTER_ORDER:'Master files must precede ordinary plugins: ', DEPENDENCY_ORDER:'A required master must be enabled before its plugin: ', forbidden:'Saving requires an authorized administrator session.',
  },
  ru: {
    modFolder:'Папка мода', modFolders:'Папки модов в data/mods', modFoldersHint:'Поместите каждый мод в отдельную папку, например data/mods/RaceMenu. При совпадении файлов побеждает папка, расположенная ниже. Игроки получают файлы в обычной папке Data.', noModFolders:'Папок модов пока нет.', inactive:'Неактивна, так как ни один плагин этой папки не включён', skseAllow:'Раздавать игрокам SKSE DLL', skseWarning:'DLL — это исполняемый код. Включайте только для модов, которым доверяете. Игроки подтверждают каждую DLL в лаунчере.', skseVersion:'Версия Skyrim для DLL', conflicts:'Конфликты файлов', skippedFiles:'Нераздаваемые файлы', replacedBy:'заменён на', INVALID_GAME_VERSION:'Укажите корректную версию Skyrim, например 1.6.1170.0.',
    title:'Порядок загрузки модов', intro:'Дополнительные игровые моды определяются автоматически. Включите нужные моды и задайте порядок для сервера и лаунчера.',
    baseFiles:'Пять обязательных игровых файлов всегда загружаются перед дополнительными модами. Они не входят в список выбираемых модов.',
    refresh:'Перечитать файлы', save:'Сохранить порядок', busy:'Загрузка …', active:'Активные моды', available:'Другие загруженные моды', empty:'Другие игровые плагины не найдены.',
    search:'Поиск модов по имени', enabled:'Включён', up:'Выше', down:'Ниже', server:'Игровой сервер', mod:'Папка мода', configured:'Конфигурация',
    directories:'Проверяемые папки', master:'Мастер-файл', plugin:'Плагин', dependencies:'Требует', readOnly:'Список доступен для просмотра. Для изменений нужен аккаунт администратора с доступом к консоли.',
    restart:'Сохранено. Перезапустите игровой сервер, чтобы применить порядок и опубликовать соответствующий манифест лаунчера.', pending:'Сохранённый порядок отличается от работающего игрового манифеста. Перезапустите игровой сервер.',
    unsaved:'Отменить несохранённые изменения и перечитать файлы?', changed:'Есть несохранённые изменения.', noPermission:'Нет разрешения на просмотр ресурсов.',
    hint:'Игровые плагины находятся в data/mods/<мод> или прямо в папке данных. Новые файлы включаются только после выбора.',
    missing:'Файл отсутствует на сервере', invalid:'Заголовок плагина повреждён или недоступен', duplicate:'Несколько файлов с таким именем',
    error:'Не удалось обработать список модов. Проверьте соединение и права на файлы.', STALE_ORDER:'Настройки или файлы модов изменились. Перечитайте список перед сохранением.', BASE_FIRST:'Skyrim.esm должен быть включён первым.',
    INVALID_ORDER:'Выберите корректный список без повторений.', DUPLICATE_PLUGIN:'Плагин выбран несколько раз: ', INVALID_PLUGIN:'Этот плагин отсутствует или недоступен: ',
    MASTER_ORDER:'Мастер-файлы должны идти перед обычными плагинами: ', DEPENDENCY_ORDER:'Нужный мастер-файл должен быть включён до зависимого плагина: ', forbidden:'Для сохранения нужна разрешённая сессия администратора.',
  },
};
type Entry = {name:string; source:'server'|'mod'|'configured'; size:number; masters:string[]; master:boolean; issue?:'missing'|'invalid'|'duplicate'; folder?:string};
type ModFolder = {name:string; plugins:string[]; active:boolean; dlls:string[]; files:number};
type Snapshot = {revision:string; loadOrder:string[]; baseLoadOrder:string[]; activeOrder:string[]; restartRequired:boolean; dataDirectory:string; modsDirectory:string; modFolders:ModFolder[]; conflicts:{file:string;winner:string;loser:string}[]; skipped:{mod:string;file:string}[]; skseFolders:string[]; skseGameVersion:string; entries:Entry[]};
type Notice = {code:string; plugin?:string; dependency?:string};
const editableOrder = (snapshot:Snapshot) => {
  const baseFiles = new Set(snapshot.baseLoadOrder.map(name => name.toLowerCase()));
  return snapshot.loadOrder.filter(name => !baseFiles.has(name.toLowerCase()));
};
export function ModLoadOrderPanel({canView,canEdit}:{canView:boolean;canEdit:boolean}) {
  const {i18n}=useTranslation(); const language=i18n.language.split('-')[0] as keyof typeof messages;
  const text=messages[language] || messages.en;
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[order,setOrder]=useState<string[]>([]),[busy,setBusy]=useState(false),[search,setSearch]=useState(''),[notice,setNotice]=useState<Notice|null>(null);
  const [folders,setFolders]=useState<string[]>([]),[skseFolders,setSkseFolders]=useState<string[]>([]),[skseVersion,setSkseVersion]=useState('');
  const panel=useRef<HTMLElement|null>(null);
  const applySnapshot=(data:Snapshot)=>{setSnapshot(data);setOrder(editableOrder(data));setFolders(data.modFolders.map(folder=>folder.name));setSkseFolders(data.skseFolders);setSkseVersion(data.skseGameVersion);};
  const foldersDirty=Boolean(snapshot&&(JSON.stringify(snapshot.modFolders.map(folder=>folder.name))!==JSON.stringify(folders)||JSON.stringify(snapshot.skseFolders)!==JSON.stringify(skseFolders)||snapshot.skseGameVersion!==skseVersion));
  const dirty=Boolean(snapshot && (JSON.stringify(editableOrder(snapshot))!==JSON.stringify(order)||foldersDirty));
  const endpoint='/api/admin/resources/load-order';
  async function load(signal?:AbortSignal) {
    setBusy(true);setNotice(null);
    try {
      const response=await fetch(endpoint,{credentials:'same-origin',cache:'no-store',signal});
      if(!response.ok)throw Error();const data:Snapshot=await response.json();
      if(!signal?.aborted)applySnapshot(data);
    }catch {if(!signal?.aborted)setNotice({code:'error'});}finally{if(!signal?.aborted)setBusy(false);}
  }
  useEffect(()=>{if(!canView)return;const controller=new AbortController();void load(controller.signal);return()=>controller.abort();},[canView]);
  async function save(){
    if(!snapshot||busy||!canEdit)return;setBusy(true);setNotice(null);
    try{
      const response=await fetch(endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:snapshot.revision,loadOrder:order,modFolders:folders,skseFolders,skseGameVersion:skseVersion})});
      const data=await response.json();if(!response.ok){setNotice(response.status===403?{code:'forbidden'}:data);return;}
      applySnapshot(data);setNotice({code:'restart'});
    }catch{setNotice({code:'error'});}finally{setBusy(false);}
  }
  const focusRow=(name:string,action='enabled')=>requestAnimationFrame(()=>{
    const row=panel.current?.querySelector<HTMLElement>('[data-plugin="'+CSS.escape(name)+'"]');
    const button=row?.querySelector<HTMLButtonElement>('button[data-action="'+action+'"]:not(:disabled)');
    (button||row?.querySelector<HTMLInputElement>('input:not(:disabled)'))?.focus();
  });
  const move=(index:number,delta:number)=>{const name=order[index];setOrder(previous=>{const next=[...previous];[next[index],next[index+delta]]=[next[index+delta],next[index]];return next;});focusRow(name,delta<0?'up':'down');};
  const moveFolder=(index:number,delta:number)=>setFolders(previous=>{const next=[...previous];[next[index],next[index+delta]]=[next[index+delta],next[index]];return next;});
  const toggle=(entry:Entry)=>{setOrder(previous=>{
    if(previous.some(name=>name.toLowerCase()===entry.name.toLowerCase()))return previous.filter(name=>name.toLowerCase()!==entry.name.toLowerCase());
    const next=[...previous],before=entry.master?next.findIndex(name=>snapshot?.entries.find(value=>value.name.toLowerCase()===name.toLowerCase())?.master===false):-1;
    next.splice(before<0?next.length:before,0,entry.name);return next;
  });focusRow(entry.name);};
  const baseFiles = new Set(snapshot?.baseLoadOrder.map(name => name.toLowerCase()) || []);
  const modEntries = (snapshot?.entries || []).filter(entry => !baseFiles.has(entry.name.toLowerCase()));
  const entries=new Map(modEntries.map(entry=>[entry.name.toLowerCase(),entry]));
  const selected=new Set(order.map(name=>name.toLowerCase())),matches=(name:string)=>name.toLowerCase().includes(search.trim().toLowerCase());
  function row(entry:Entry,index:number|null){
    const active=index!==null;
    const occurrence=active?order.slice(0,index!).filter(name=>name.toLowerCase()===entry.name.toLowerCase()).length:0;
    return <li key={entry.name+':'+occurrence} className="mod-load-order__row" data-plugin={entry.name}>
      <label><input type="checkbox" checked={active} disabled={busy||!canEdit||!active&&Boolean(entry.issue)} onChange={()=>toggle(entry)} aria-label={text.enabled+': '+entry.name}/>
        <span><strong>{entry.name}</strong><small>{entry.master?text.master:text.plugin} · {entry.folder||text[entry.source]} · {(entry.size/1024).toLocaleString(language,{maximumFractionDigits:1})} KiB</small>
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
      {snapshot&&<><p>{text.baseFiles}</p><p className="mod-load-order__directories">{text.directories}: <code>{snapshot.dataDirectory}</code> · <code>{snapshot.modsDirectory}</code></p><p>{text.hint}</p>
        {snapshot.restartRequired&&notice?.code!=='restart'&&<p className="mod-load-order__notice" role="status">{text.pending}</p>}
        <label className="mod-load-order__search">{text.search}<input type="search" value={search} onChange={event=>setSearch(event.target.value)}/></label>
        <h3>{text.active} <span>({order.length})</span></h3><ol className="mod-load-order__list">{order.map((name,index)=>{const entry=entries.get(name.toLowerCase());return entry&&matches(name)?row(entry,index):null;})}</ol>
        <h3>{text.available}</h3><ul className="mod-load-order__list">{modEntries.filter(entry=>!selected.has(entry.name.toLowerCase())&&matches(entry.name)).map(entry=>row(entry,null))}</ul>
        {!modEntries.some(entry=>!selected.has(entry.name.toLowerCase())&&matches(entry.name))&&<p>{text.empty}</p>}
        <h3>{text.modFolders} <span>({folders.length})</span></h3><p>{text.modFoldersHint}</p>
        {folders.length===0?<p>{text.noModFolders}</p>:<ol className="mod-load-order__list">{folders.map((name,index)=>{const folder=snapshot.modFolders.find(value=>value.name===name);return folder?<li key={name} className="mod-load-order__row">
          <span><strong>{name}</strong><small>{folder.plugins.join(', ')||text.modFolder} · {folder.files}</small>{!folder.active&&<small className="mod-load-order__issue">{text.inactive}</small>}
            {folder.dlls.length>0&&<label><input type="checkbox" checked={skseFolders.includes(name)} disabled={busy||!canEdit} onChange={event=>setSkseFolders(previous=>event.target.checked?[...previous,name]:previous.filter(value=>value!==name))}/> {text.skseAllow}: {folder.dlls.map(file=>file.split('/').pop()).join(', ')}</label>}</span>
          <div className="mod-load-order__moves"><span aria-label={text.modFolder}>{index+1}</span>
            <button type="button" disabled={busy||!canEdit||index===0} aria-label={text.up+': '+name} onClick={()=>moveFolder(index,-1)}>↑</button>
            <button type="button" disabled={busy||!canEdit||index===folders.length-1} aria-label={text.down+': '+name} onClick={()=>moveFolder(index,1)}>↓</button></div>
        </li>:null;})}</ol>}
        {skseFolders.length>0&&<><p className="mod-load-order__notice" role="status">{text.skseWarning}</p><label className="mod-load-order__search">{text.skseVersion}<input value={skseVersion} disabled={busy||!canEdit} maxLength={32} placeholder="1.6.1170.0" onChange={event=>setSkseVersion(event.target.value.trim())}/></label></>}
        {snapshot.conflicts.length>0&&<><h3>{text.conflicts}</h3><ul>{snapshot.conflicts.map(item=><li key={item.file+item.winner}><code>{item.file}</code>: {item.loser} {text.replacedBy} {item.winner}</li>)}</ul></>}
        {snapshot.skipped.length>0&&<><h3>{text.skippedFiles}</h3><ul>{snapshot.skipped.slice(0,100).map(item=><li key={item.mod+item.file}>{item.mod}: <code>{item.file}</code></li>)}</ul></>}
        <footer><button type="button" className="mod-load-order__save" disabled={!dirty||busy||!canEdit} onClick={()=>void save()}>{busy?text.busy:text.save}</button>{dirty&&<span role="status">{text.changed}</span>}</footer>
      </>}
    </>}
  </section>;
}
