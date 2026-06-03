/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useContext } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Check, ChevronRight, Pencil } from 'lucide-react';
import { PALETTE } from './palette';
import { WizardFooterContext } from '../shell/footerSlot';

// Shared "selected" treatment so every picker reads consistently:
// a 2px brass border + a soft brass ring/glow, and (for image cards) a
// corner check badge. Use SELECTED_BORDER / SELECTED_RING together.
export const SELECTED_BORDER = `2px solid ${PALETTE.brass}`;
export const SELECTED_RING = '0 0 0 3px rgba(201,169,97,0.20)';

// Corner check badge for image/thumbnail cards. The parent card must be
// position: relative; this absolutely-positions itself at top-right.
export const SelectedBadge = () => (
  <div style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: '50%',
    background: PALETTE.brass, display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(0,0,0,0.25)', zIndex: 3, pointerEvents: 'none' }}>
    <Check size={14} color="#fff" strokeWidth={3} />
  </div>
);

// Typed public-API prop interfaces. A couple of polymorphic primitives (Serif,
// Sans) use an `any`-typed `as`/rest-prop escape hatch — the eslint rule for
// that is disabled above — but every exported component carries an explicit
// prop interface, so consumers get correct optional props.

export interface SerifProps {
  children?: React.ReactNode;
  style?: React.CSSProperties;
  italic?: boolean;
  as?: React.ElementType;
  [key: string]: any;
}
export const Serif = ({ children, style, italic, as = 'div', ...rest }: SerifProps) => {
  const Tag: any = as;
  return <Tag {...rest} style={{ fontFamily: '"Cormorant Garamond", Garamond, Georgia, serif', fontWeight: 400, fontStyle: italic ? 'italic' : 'normal', ...style }}>{children}</Tag>;
};

export interface SansProps {
  children?: React.ReactNode;
  style?: React.CSSProperties;
  as?: React.ElementType;
  [key: string]: any;
}
export const Sans = ({ children, style, as = 'div', ...rest }: SansProps) => {
  const Tag: any = as;
  return <Tag {...rest} style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif', ...style }}>{children}</Tag>;
};

export interface EyebrowProps {
  children?: React.ReactNode;
  color?: string;
}
export const Eyebrow = ({ children, color = PALETTE.brass }: EyebrowProps) => (
  <Sans style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color, fontWeight: 500 }}>{children}</Sans>
);

export interface PrimaryButtonProps {
  children?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  full?: boolean;
  secondary?: boolean;
  small?: boolean;
}
export const PrimaryButton = ({ children, onClick, disabled, full, secondary, small }: PrimaryButtonProps) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      fontFamily: 'Inter, sans-serif',
      fontSize: small ? 13 : 14,
      letterSpacing: '0.02em',
      padding: small ? '8px 16px' : '14px 28px',
      border: secondary ? `1px solid ${PALETTE.espresso}` : 'none',
      background: disabled ? PALETTE.parchmentLight : (secondary ? 'transparent' : PALETTE.espresso),
      color: disabled ? PALETTE.mute : (secondary ? PALETTE.espresso : PALETTE.bone),
      cursor: disabled ? 'not-allowed' : 'pointer',
      borderRadius: 2,
      width: full ? '100%' : 'auto',
      transition: 'all 200ms ease',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    }}
    onMouseEnter={e => !disabled && (e.currentTarget.style.background = secondary ? PALETTE.espresso : PALETTE.brassDeep) && (secondary && (e.currentTarget.style.color = PALETTE.bone))}
    onMouseLeave={e => !disabled && (e.currentTarget.style.background = secondary ? 'transparent' : PALETTE.espresso) && (secondary && (e.currentTarget.style.color = PALETTE.espresso))}
  >
    {children}
  </button>
);

export interface PillProps {
  active?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
  large?: boolean;
}
export const Pill = ({ active, onClick, children, large }: PillProps) => (
  <button
    onClick={onClick}
    style={{
      fontFamily: 'Inter, sans-serif',
      fontSize: large ? 14 : 13,
      padding: large ? '12px 22px' : '8px 16px',
      border: active ? SELECTED_BORDER : `1px solid ${PALETTE.parchment}`,
      background: active ? PALETTE.espresso : 'transparent',
      color: active ? PALETTE.bone : PALETTE.espresso,
      boxShadow: active ? SELECTED_RING : 'none',
      borderRadius: 999,
      cursor: 'pointer',
      transition: 'all 180ms ease',
      letterSpacing: '0.01em',
    }}
  >
    {children}
  </button>
);

export interface StageShellProps {
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  lede?: React.ReactNode;
  children?: React.ReactNode;
  onNext?: () => void;
  onBack?: () => void;
  canNext?: boolean;
  nextLabel?: string;
  hideNext?: boolean;
  secondaryAction?: React.ReactNode;
}
export const StageShell = ({ eyebrow, title, lede, children, onNext, onBack, canNext, nextLabel = 'Continue', hideNext, secondaryAction }: StageShellProps) => {
  const footerEl = useContext(WizardFooterContext);

  // The action bar's inner row — Back on the left, secondary + Continue on the
  // right — capped to the content width so it lines up with the step body.
  const barInner = (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <button onClick={onBack}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: PALETTE.mute, fontFamily: 'Inter, sans-serif', fontSize: 13, cursor: 'pointer', padding: 0 }}>
        <ArrowLeft size={14}/> Back
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        {secondaryAction}
        {!hideNext && (
          <PrimaryButton onClick={onNext} disabled={!canNext}>
            {nextLabel} <ArrowRight size={15}/>
          </PrimaryButton>
        )}
      </div>
    </div>
  );

  // Full-bleed bar surface — solid page bg, top border + soft upward shadow.
  const bar = (
    <div style={{ background: PALETTE.bone, borderTop: `1px solid ${PALETTE.parchmentLight}`, boxShadow: '0 -10px 28px rgba(42,33,27,0.06)' }}>
      {barInner}
    </div>
  );

  return (
    <section style={{ paddingTop: 16 }}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Serif as="h2" italic style={{ fontSize: 'clamp(34px, 4.5vw, 52px)', lineHeight: 1.05, marginTop: 14, marginBottom: 12, letterSpacing: '-0.01em' }}>
        {title}
      </Serif>
      <Serif style={{ fontSize: 18, color: PALETTE.mute, lineHeight: 1.5, maxWidth: 620, marginBottom: 36 }}>
        {lede}
      </Serif>
      <div>{children}</div>
      {/* Pin the action bar to the locked footer slot below the scroll region.
          Fallback to an inline bar when used outside the wizard shell. */}
      {footerEl
        ? createPortal(bar, footerEl)
        : <div style={{ marginTop: 40 }}>{bar}</div>}
    </section>
  );
};

export interface FieldGroupProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  children?: React.ReactNode;
}
export const FieldGroup = ({ label, hint, children }: FieldGroupProps) => (
  <div style={{ marginBottom: 36 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
      <Serif style={{ fontSize: 22, color: PALETTE.espresso }}>{label}</Serif>
      {hint && <Sans style={{ fontSize: 12, color: PALETTE.mute, fontStyle: 'italic' }}>{hint}</Sans>}
    </div>
    {children}
  </div>
);

export interface ChoiceCardProps {
  active?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
  emoji?: string;
  title?: React.ReactNode;
  desc?: React.ReactNode;
  compact?: boolean;
}
export const ChoiceCard = ({ active, onClick, icon, emoji, title, desc, compact }: ChoiceCardProps) => (
  <button onClick={onClick}
    style={{
      textAlign: 'left', padding: compact ? '14px 16px' : '18px 18px',
      border: active ? SELECTED_BORDER : `1px solid ${PALETTE.parchmentLight}`,
      background: active ? PALETTE.boneSoft : 'white',
      boxShadow: active ? SELECTED_RING : 'none',
      cursor: 'pointer', borderRadius: 4, transition: 'all 180ms ease',
      display: 'flex', flexDirection: 'column', gap: 6, minHeight: compact ? 'auto' : 100,
    }}
    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.borderColor = PALETTE.brass; }}
    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.borderColor = PALETTE.parchmentLight; }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: PALETTE.brassDeep }}>
      {emoji ? <span style={{ fontSize: 18 }}>{emoji}</span> : icon}
      <Serif style={{ fontSize: 18, color: PALETTE.espresso }}>{title}</Serif>
      {active && <Check size={14} color={PALETTE.espresso} style={{ marginLeft: 'auto' }}/>}
    </div>
    <Serif italic style={{ fontSize: 14, color: PALETTE.mute, lineHeight: 1.4 }}>{desc}</Serif>
  </button>
);

export interface PathCardProps {
  title?: React.ReactNode;
  tagline?: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
  accent?: boolean;
}
export const PathCard = ({ title, tagline, icon, onClick, accent }: PathCardProps) => (
  <button onClick={onClick}
    style={{
      position: 'relative',
      textAlign: 'left', padding: '32px 28px',
      border: accent ? SELECTED_BORDER : `1px solid ${PALETTE.parchment}`,
      background: accent ? 'rgba(201,169,97,0.06)' : 'white',
      boxShadow: accent ? SELECTED_RING : 'none',
      cursor: 'pointer', borderRadius: 4, transition: 'all 200ms ease', minHeight: 200,
      display: 'flex', flexDirection: 'column', gap: 14,
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = accent ? `${SELECTED_RING}, 0 12px 32px rgba(42,33,27,0.08)` : '0 12px 32px rgba(42,33,27,0.08)'; }}
    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'none'; (e.currentTarget as HTMLButtonElement).style.boxShadow = accent ? SELECTED_RING : 'none'; }}>
    {accent && <SelectedBadge />}
    <div style={{ color: PALETTE.brassDeep }}>{icon}</div>
    <Serif style={{ fontSize: 28 }}>{title}</Serif>
    <Serif italic style={{ fontSize: 16, color: PALETTE.mute, lineHeight: 1.4 }}>{tagline}</Serif>
    <div style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, color: accent ? PALETTE.brassDeep : PALETTE.espresso }}>
      <Sans style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Choose this</Sans>
      <ChevronRight size={14}/>
    </div>
  </button>
);

export interface TagProps {
  children?: React.ReactNode;
}
export const Tag = ({ children }: TagProps) => (
  <Sans style={{
    fontSize: 11, padding: '4px 8px', border: `1px solid ${PALETTE.parchment}`, borderRadius: 999,
    color: PALETTE.mute, letterSpacing: '0.04em',
  }}>{children}</Sans>
);

export interface SummaryItemProps {
  label?: React.ReactNode;
  value?: React.ReactNode;
}
export const SummaryItem = ({ label, value }: SummaryItemProps) => (
  <div>
    <Sans style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: PALETTE.mute }}>{label}</Sans>
    <Serif italic style={{ fontSize: 18, color: PALETTE.espresso, marginTop: 2 }}>{value}</Serif>
  </div>
);

// ---- NEW: Wave 2 primitives ----

export interface ApprovalOption {
  id: string;
  label: string;
  tone?: 'primary' | 'default';
}

export interface ApprovalPillsProps {
  options: ApprovalOption[];
  onSelect: (id: string) => void;
  selected?: string | null;
}
export const ApprovalPills = ({ options, onSelect, selected }: ApprovalPillsProps) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
    {options.map(opt => {
      const isPrimary = opt.tone === 'primary';
      const isSelected = selected === opt.id;
      return (
        <button
          key={opt.id}
          onClick={() => onSelect(opt.id)}
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 14,
            padding: '12px 24px',
            border: `1px solid ${isSelected || isPrimary ? PALETTE.espresso : PALETTE.parchment}`,
            background: isSelected ? PALETTE.espresso : (isPrimary ? PALETTE.espressoSoft : 'transparent'),
            color: isSelected || isPrimary ? PALETTE.bone : PALETTE.espresso,
            borderRadius: 999,
            cursor: 'pointer',
            transition: 'all 180ms ease',
            letterSpacing: '0.01em',
            fontWeight: isPrimary ? 500 : 400,
          }}
        >
          {opt.label}
        </button>
      );
    })}
  </div>
);

export interface GateReviewProps {
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  lede?: React.ReactNode;
  children?: React.ReactNode;
  options: ApprovalOption[];
  onSelect: (id: string) => void;
  selected?: string | null;
  correctionLabel?: string;
  correctionValue?: string;
  onCorrectionChange?: (v: string) => void;
  onBack?: () => void;
}
export const GateReview = ({
  eyebrow, title, lede, children,
  options, onSelect, selected,
  correctionLabel = 'Notes or corrections',
  correctionValue, onCorrectionChange,
  onBack,
}: GateReviewProps) => (
  <section style={{ paddingTop: 16 }}>
    <Eyebrow>{eyebrow}</Eyebrow>
    <Serif as="h2" italic style={{ fontSize: 'clamp(34px, 4.5vw, 52px)', lineHeight: 1.05, marginTop: 14, marginBottom: 12, letterSpacing: '-0.01em' }}>
      {title}
    </Serif>
    <Serif style={{ fontSize: 18, color: PALETTE.mute, lineHeight: 1.5, maxWidth: 620, marginBottom: 36 }}>
      {lede}
    </Serif>
    <div>{children}</div>
    <div style={{ marginTop: 40, borderTop: `1px solid ${PALETTE.parchmentLight}`, paddingTop: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ApprovalPills options={options} onSelect={onSelect} selected={selected} />
      {onCorrectionChange && (
        <div style={{ marginTop: 8 }}>
          <Sans style={{ fontSize: 12, color: PALETTE.mute, marginBottom: 8 }}>{correctionLabel}</Sans>
          <textarea
            value={correctionValue ?? ''}
            onChange={e => onCorrectionChange(e.target.value)}
            placeholder="Optional — share anything you'd like adjusted…"
            rows={3}
            style={{
              width: '100%',
              fontFamily: 'Inter, sans-serif',
              fontSize: 14,
              padding: '12px 14px',
              border: `1px solid ${PALETTE.parchmentLight}`,
              borderRadius: 4,
              background: PALETTE.boneSoft,
              color: PALETTE.espresso,
              resize: 'vertical',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>
      )}
      {onBack && (
        <button onClick={onBack}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: PALETTE.mute, fontFamily: 'Inter, sans-serif', fontSize: 13, cursor: 'pointer', padding: 0, alignSelf: 'flex-start' }}>
          <ArrowLeft size={14}/> Back
        </button>
      )}
    </div>
  </section>
);

export interface EditChipProps {
  label: string;
  value?: React.ReactNode;
  onClick?: () => void;
}
export const EditChip = ({ label, value, onClick }: EditChipProps) => (
  <button
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 14px',
      border: `1px solid ${PALETTE.parchmentLight}`,
      borderRadius: 4,
      background: PALETTE.boneSoft,
      cursor: onClick ? 'pointer' : 'default',
      fontFamily: 'Inter, sans-serif',
      transition: 'border-color 180ms ease',
    }}
    onMouseEnter={e => onClick && ((e.currentTarget as HTMLButtonElement).style.borderColor = PALETTE.brass)}
    onMouseLeave={e => onClick && ((e.currentTarget as HTMLButtonElement).style.borderColor = PALETTE.parchmentLight)}
  >
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
      <Sans style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: PALETTE.mute }}>{label}</Sans>
      <Serif italic style={{ fontSize: 16, color: PALETTE.espresso }}>{value}</Serif>
    </div>
    {onClick && <Pencil size={12} color={PALETTE.brassDeep} style={{ flexShrink: 0 }}/>}
  </button>
);
