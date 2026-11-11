import {readFileSync} from 'node:fs';
// Source assertions follow the real implementation after controller/view extraction.
export function readStudioSource(){return ['src/features/studio/studio-workspace-config.ts','src/features/studio/use-studio-controller.tsx','src/features/studio/use-studio-task-history.ts','src/features/studio/studio-shell.tsx','src/features/studio/studio-creation-workspace.tsx','src/app/studio/studio-client.tsx'].map(file=>readFileSync(file,'utf8').replace(/^export (?=(?:const|function|type|interface)\b)/gm,'')).join('\n');}
