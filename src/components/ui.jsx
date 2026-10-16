import * as React from 'react';
import { cva } from 'class-variance-authority';
import * as TooltipP from '@radix-ui/react-tooltip';
import * as HoverCardP from '@radix-ui/react-hover-card';
import * as PopoverP from '@radix-ui/react-popover';
import * as DropdownP from '@radix-ui/react-dropdown-menu';
import * as DialogP from '@radix-ui/react-dialog';
import * as SwitchP from '@radix-ui/react-switch';
import * as SliderP from '@radix-ui/react-slider';
import * as CheckboxP from '@radix-ui/react-checkbox';
import { Command as Cmdk } from 'cmdk';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

import { cn } from '../lib/utils.js';

/* ---------------------------------------------------------------- button */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-[background,border-color,color,opacity,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-40 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'cta-grad text-white shadow-cta hover:brightness-110',
        gold: 'cta-grad text-white shadow-cta hover:brightness-110',
        light: 'bg-white text-[hsl(228_30%_9%)] hover:bg-white/90',
        outline: 'border border-line2 bg-raised/60 text-fg hover:border-gold/50 hover:bg-raised',
        ghost: 'text-fg2 hover:bg-fg/6 hover:text-fg',
        soft: 'bg-fg/6 text-fg hover:bg-fg/10',
        goldsoft: 'border border-gold/45 bg-gold/8 text-fg hover:border-gold/80 hover:bg-gold/12'
      },
      size: {
        xs: 'h-6 rounded-lg px-2 text-xs',
        sm: 'h-8 rounded-[10px] px-3 text-[12.5px]',
        md: 'h-9 rounded-ctl px-3.5 text-[13px]',
        lg: 'h-11 rounded-[14px] px-5 text-[14px] font-semibold',
        icon: 'h-9 w-9 rounded-full',
        iconsm: 'h-8 w-8 rounded-full'
      }
    },
    defaultVariants: { variant: 'outline', size: 'md' }
  }
);
export const Button = React.forwardRef(({ className, variant, size, ...p }, ref) => (
  <button ref={ref} type="button" className={cn(buttonVariants({ variant, size }), className)} {...p} />
));

/* ---------------------------------------------------------------- badge */
const badgeV = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 h-[22px] text-[11.5px] font-semibold',
  {
    variants: {
      tone: {
        neutral: 'bg-fg/6 text-fg2',
        gold: 'bg-gold/13 text-gold',
        pos: 'bg-pos/12 text-pos',
        neg: 'bg-neg/12 text-neg',
        info: 'bg-info/12 text-info',
        warn: 'bg-warn/13 text-warn',
        presence: 'bg-presence/15 text-presence',
        outline: 'border border-line2 text-fg2 bg-raised/50'
      }
    },
    defaultVariants: { tone: 'neutral' }
  }
);
export function Badge({ tone, dot, pulse, className, children }) {
  return (
    <span className={cn(badgeV({ tone }), className)}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full bg-current', pulse && 'animate-pulse2')} />}
      {children}
    </span>
  );
}
export function Kbd({ children, className }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-line2 bg-overlay px-1.5 font-sans text-[10.5px] font-semibold text-fg3',
        className
      )}
    >
      {children}
    </kbd>
  );
}

/* ---------------------------------------------------------------- tooltip */
export const TooltipProvider = TooltipP.Provider;
export function Tip({ label, side = 'bottom', children, kbd }) {
  if (!label) return children;
  return (
    <TooltipP.Root>
      <TooltipP.Trigger asChild>{children}</TooltipP.Trigger>
      <TooltipP.Portal>
        <TooltipP.Content
          side={side}
          sideOffset={6}
          className="glass z-100 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-fg shadow-pop data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95"
        >
          {label}
          {kbd && <span className="opacity-60">{kbd}</span>}
        </TooltipP.Content>
      </TooltipP.Portal>
    </TooltipP.Root>
  );
}

/* ---------------------------------------------------------------- hover card */
export const HoverCard = HoverCardP.Root;
export const HoverCardTrigger = HoverCardP.Trigger;
export function HoverCardContent({ className, ...p }) {
  return (
    <HoverCardP.Portal>
      <HoverCardP.Content
        sideOffset={8}
        className={cn(
          'glass z-90 w-72 rounded-2xl p-3.5 text-fg shadow-pop outline-hidden data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className
        )}
        {...p}
      />
    </HoverCardP.Portal>
  );
}

/* ---------------------------------------------------------------- popover */
export const Popover = PopoverP.Root;
export const PopoverTrigger = PopoverP.Trigger;
export function PopoverContent({ className, align = 'end', ...p }) {
  return (
    <PopoverP.Portal>
      <PopoverP.Content
        align={align}
        sideOffset={8}
        className={cn(
          'glass z-90 w-72 rounded-2xl p-1.5 text-fg shadow-pop outline-hidden data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          className
        )}
        {...p}
      />
    </PopoverP.Portal>
  );
}

/* ---------------------------------------------------------------- dropdown */
export const Dropdown = DropdownP.Root;
export const DropdownTrigger = DropdownP.Trigger;
export function DropdownContent({ className, align = 'start', ...p }) {
  return (
    <DropdownP.Portal>
      <DropdownP.Content
        align={align}
        sideOffset={8}
        className={cn(
          'glass z-90 min-w-[220px] rounded-2xl p-1.5 text-fg shadow-pop outline-hidden data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className
        )}
        {...p}
      />
    </DropdownP.Portal>
  );
}
export function DropdownItem({ className, ...p }) {
  return (
    <DropdownP.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] outline-hidden data-highlighted:bg-fg/6',
        className
      )}
      {...p}
    />
  );
}
export function DropdownLabel({ className, ...p }) {
  return <DropdownP.Label className={cn('px-2 pb-1 pt-1.5 text-xs font-medium text-fg3', className)} {...p} />;
}
export function DropdownSep() {
  return <DropdownP.Separator className="my-1 h-px bg-line" />;
}

/* ---------------------------------------------------------------- dialog & sheet */
export const Dialog = DialogP.Root;
export function DialogContent({ className, children, label, top, ...p }) {
  return (
    <DialogP.Portal>
      <DialogP.Overlay className="fixed inset-0 z-80 bg-[hsl(var(--shadow)/.45)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <DialogP.Content
        aria-describedby={undefined}
        className={cn(
          'glass fixed left-1/2 z-81 w-[min(640px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-frame text-fg shadow-pop outline-hidden data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[.98] data-[state=open]:slide-in-from-top-2',
          top ? 'top-[12vh]' : 'top-1/2 -translate-y-1/2',
          className
        )}
        {...p}
      >
        <DialogP.Title className="sr-only">{label}</DialogP.Title>
        {children}
      </DialogP.Content>
    </DialogP.Portal>
  );
}
export function Sheet({ open, onOpenChange, side = 'right', label, children, className }) {
  return (
    <DialogP.Root open={open} onOpenChange={onOpenChange}>
      <DialogP.Portal>
        <DialogP.Overlay className="fixed inset-0 z-70 bg-[hsl(var(--shadow)/.45)] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogP.Content
          aria-describedby={undefined}
          className={cn(
            'fixed inset-y-0 z-71 flex flex-col bg-chrome shadow-pop outline-hidden data-[state=open]:animate-in data-[state=open]:duration-200',
            side === 'right'
              ? 'right-0 w-[min(460px,100vw)] data-[state=open]:slide-in-from-right'
              : 'left-0 w-[284px] data-[state=open]:slide-in-from-left',
            className
          )}
        >
          <DialogP.Title className="sr-only">{label}</DialogP.Title>
          {children}
        </DialogP.Content>
      </DialogP.Portal>
    </DialogP.Root>
  );
}

/* ---------------------------------------------------------------- inputs */
export function Switch({ checked, onCheckedChange, id, label }) {
  return (
    <SwitchP.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={label}
      className="relative h-5 w-9 shrink-0 rounded-full bg-line2 transition-colors data-[state=checked]:bg-gold focus-visible:outline-2"
    >
      <SwitchP.Thumb className="block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[18px]" />
    </SwitchP.Root>
  );
}
export function Slider({ value, onValueChange, min, max, step, label, className }) {
  return (
    <SliderP.Root
      value={[value]}
      onValueChange={v => onValueChange(v[0])}
      min={min}
      max={max}
      step={step}
      aria-label={label}
      className={cn('relative flex h-5 w-full touch-none select-none items-center', className)}
    >
      <SliderP.Track className="relative h-1 grow overflow-hidden rounded-full bg-line2">
        <SliderP.Range className="cta-grad absolute h-full" />
      </SliderP.Track>
      <SliderP.Thumb className="block h-[18px] w-[18px] rounded-full border-[3px] border-white bg-gold shadow-[0_0_0_4px_hsl(var(--gold)/.25)] transition-transform hover:scale-110 focus-visible:outline-2" />
    </SliderP.Root>
  );
}
export function Checkbox({ checked, onCheckedChange, id }) {
  return (
    <CheckboxP.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border border-line2 bg-inset data-[state=checked]:border-gold data-[state=checked]:bg-gold data-[state=checked]:text-white"
    >
      <CheckboxP.Indicator>
        <Check size={12} strokeWidth={3} />
      </CheckboxP.Indicator>
    </CheckboxP.Root>
  );
}
export function Segmented({ value, onChange, options, label, id, size = 'md', className }) {
  const gid = React.useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex items-center gap-0.5 rounded-full bg-raised p-1 ring-1 ring-line', className)}
    >
      {options.map(o => {
        const on = o.v === value;
        return (
          <button
            key={String(o.v)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.v)}
            className={cn(
              'relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-colors',
              size === 'sm' ? 'h-6 px-2.5 text-xs' : 'h-7 px-3 text-[12.5px]',
              on ? 'text-fg' : 'text-fg3 hover:text-fg'
            )}
          >
            {on && (
              <motion.span
                layoutId={(id || gid) + '-pill'}
                className="absolute inset-0 rounded-full bg-overlay shadow-[0_0_0_1.5px_hsl(var(--fg)/.55),0_4px_14px_-4px_hsl(var(--shadow)/.6)]"
                transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }}
              />
            )}
            <span className="relative z-1 inline-flex items-center gap-1.5">
              {o.i && <o.i size={13} />}
              {o.l}
            </span>
          </button>
        );
      })}
    </div>
  );
}
export function Progress({ value, tone = 'gold', className }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('relative h-1.5 min-w-[40px] overflow-hidden rounded-full bg-fg/[.07]', className)}
    >
      <div
        className={cn(
          'absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ease-linear',
          tone === 'pos' ? 'bg-pos' : tone === 'fg' ? 'bg-fg2' : 'cta-grad'
        )}
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- command */
export function CommandDialog({ open, onOpenChange, children }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent label="Command palette" top className="w-[min(660px,calc(100vw-32px))]">
        <Cmdk loop className="flex flex-col" filter={(v, s) => (v.toLowerCase().includes(s.toLowerCase()) ? 1 : 0)}>
          {children}
        </Cmdk>
      </DialogContent>
    </Dialog>
  );
}
export const CmdInput = React.forwardRef((p, ref) => (
  <Cmdk.Input
    ref={ref}
    {...p}
    className="h-[56px] w-full border-b border-line bg-transparent px-4 text-[15px] text-fg outline-hidden placeholder:text-fg3"
  />
));
export function CmdList({ children }) {
  return <Cmdk.List className="max-h-[min(440px,56vh)] overflow-y-auto overscroll-contain p-1.5">{children}</Cmdk.List>;
}
export function CmdGroup({ heading, children }) {
  return (
    <Cmdk.Group
      heading={heading}
      className="**:[[cmdk-group-heading]]:px-2.5 **:[[cmdk-group-heading]]:pb-1 **:[[cmdk-group-heading]]:pt-2 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:text-fg3"
    >
      {children}
    </Cmdk.Group>
  );
}
export function CmdItem({ children, onSelect, value }) {
  return (
    <Cmdk.Item
      value={value}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] text-fg aria-selected:bg-fg/[.07] [&_svg]:text-fg3"
    >
      {children}
    </Cmdk.Item>
  );
}
export const CmdEmpty = Cmdk.Empty;

export { X, DialogP };
