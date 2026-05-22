export type StepId =
  | 'welcome'
  | 'returning'
  | 'photos'
  | 'name_gender'
  | 'vision'
  | 'memory_rel'
  | 'traits_fav'
  | 'creator_years'
  | 'character'
  | 'length_aspect'
  | 'curators'
  | 'style_confirm'
  | 'format'
  | 'theme'
  | 'style'
  | 'combo_preview'
  | 'beatsheet'
  | 'caption_container'
  | 'storyboard'
  | 'words'
  | 'card_preview'
  | 'cinematography'
  | 'generate'
  | 'finished';

export interface StepDef {
  id: StepId;
  group: 'intake' | 'likeness' | 'direction' | 'story' | 'words' | 'finish';
  gate?: 1 | 2 | 3;
  skillStage: string;
}

export const STEP_GROUPS = [
  { id: 'intake',    label: 'Tell us about them' },
  { id: 'likeness',  label: 'Their likeness' },
  { id: 'direction', label: 'The direction' },
  { id: 'story',     label: 'The story' },
  { id: 'words',     label: 'The words' },
  { id: 'finish',    label: 'The tribute' },
] as const;

export const STEPS: StepDef[] = [
  { id: 'welcome',          group: 'intake',     skillStage: '1.0' },
  { id: 'returning',        group: 'intake',     skillStage: '1.1' },
  { id: 'photos',           group: 'intake',     skillStage: '1.2' },
  { id: 'name_gender',      group: 'intake',     skillStage: '1.3' },
  { id: 'vision',           group: 'intake',     skillStage: '1.4' },
  { id: 'memory_rel',       group: 'intake',     skillStage: '1.6' },
  { id: 'traits_fav',       group: 'intake',     skillStage: '1.9' },
  { id: 'creator_years',    group: 'intake',     skillStage: '1.11' },
  { id: 'character',        group: 'likeness',   gate: 1, skillStage: '2' },
  { id: 'length_aspect',    group: 'likeness',   skillStage: '2.5' },
  { id: 'curators',         group: 'direction',  skillStage: '3.1' },
  { id: 'style_confirm',    group: 'direction',  skillStage: '3.1.5' },
  { id: 'format',           group: 'direction',  skillStage: '3.2' },
  { id: 'theme',            group: 'direction',  skillStage: '3.3' },
  { id: 'style',            group: 'direction',  skillStage: '3.4' },
  { id: 'combo_preview',    group: 'direction',  skillStage: '3.5' },
  { id: 'beatsheet',        group: 'story',      skillStage: '4' },
  { id: 'caption_container',group: 'story',      skillStage: '4.5' },
  { id: 'words',            group: 'story',      skillStage: '5.5' },
  { id: 'storyboard',       group: 'story',      gate: 2, skillStage: '5' },
  { id: 'card_preview',     group: 'words',      skillStage: '5.6' },
  { id: 'cinematography',   group: 'words',      gate: 3, skillStage: '5.7' },
  { id: 'generate',         group: 'finish',     skillStage: '6' },
  { id: 'finished',         group: 'finish',     skillStage: '7' },
];
