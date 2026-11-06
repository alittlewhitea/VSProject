"use client";

import { useRef, useState } from "react";
import { avatarFilterOptions, emptyAvatarFilters, type AvatarFilterField, type AvatarFilters } from "../../lib/avatar-catalog-filters";
import type { avatarFilterCopy } from "./avatar-filter-copy";
import { useStudioDialog } from "./use-studio-dialog";
import styles from "./studio-avatar-library.module.css";

export function AvatarFiltersPanel({value, available, copy, onApply, onClose}: {
  value: AvatarFilters;
  available: Record<AvatarFilterField, boolean>;
  copy: ReturnType<typeof avatarFilterCopy>;
  onApply: (value: AvatarFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const dialog = useRef<HTMLDivElement>(null);
  useStudioDialog(true, dialog, {onClose, lockScroll: false});
  return <>
    <button type="button" className={styles.filterShade} aria-label={copy.done} tabIndex={-1} onClick={onClose}/>
    <div ref={dialog} role="dialog" aria-modal="true" aria-label={copy.filters} tabIndex={-1} className={styles.filterPanel}>
      {(Object.keys(avatarFilterOptions) as AvatarFilterField[]).map(field => <fieldset key={field} disabled={!available[field]}>
        <legend>{copy[field]}</legend>
        <div className={styles.filterChoices}>{avatarFilterOptions[field].map(option => <button type="button" key={option} aria-pressed={draft[field].includes(option)} onClick={()=>setDraft(current=>({...current,[field]:current[field].includes(option)?current[field].filter(item=>item!==option):[...current[field],option]}))}>{copy[option]}</button>)}</div>
      </fieldset>)}
      <div className={styles.filterActions}><button type="button" onClick={()=>setDraft(emptyAvatarFilters())}>{copy.reset}</button><button type="button" onClick={()=>onApply(draft)}>{copy.done}</button></div>
    </div>
  </>;
}
