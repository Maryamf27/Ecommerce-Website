"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export type SelectOption = { value: string; label: string; disabled?: boolean };

type SelectProps = {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** Accessible name when there is no visible <label>. */
  label?: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  compact?: boolean;
  className?: string;
};

type PanelPosition = { left: number; width: number; maxHeight: number; top?: number; bottom?: number };

/**
 * Theme-matching dropdown that replaces the native <select>, whose option list
 * the browser draws itself and CSS cannot style. The list renders in a portal
 * so tables and cards with overflow never clip it.
 */
export default function Select({ value, options, onChange, label, id, placeholder = "Select…", disabled, invalid, describedBy, compact, className = "" }: SelectProps) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ text: "", timer: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [position, setPosition] = useState<PanelPosition | null>(null);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const margin = 8;
    const wanted = Math.min(280, options.length * 42 + 12);
    const below = window.innerHeight - rect.bottom - margin;
    const above = rect.top - margin;
    const openUp = below < wanted && above > below;
    const width = Math.max(rect.width, compact ? 170 : 0);
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
    setPosition(openUp
      ? { left, width, bottom: window.innerHeight - rect.top + 6, maxHeight: Math.max(120, Math.min(280, above - 6)) }
      : { left, width, top: rect.bottom + 6, maxHeight: Math.max(120, Math.min(280, below - 6)) });
  }, [options.length, compact]);

  const openMenu = useCallback(() => {
    if (disabled) return;
    place();
    setActive(selectedIndex >= 0 ? selectedIndex : options.findIndex((option) => !option.disabled));
    setOpen(true);
  }, [disabled, place, selectedIndex, options]);

  const closeMenu = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  const choose = useCallback((index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    closeMenu();
  }, [options, onChange, closeMenu]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: Event) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const reposition = () => place();
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open || active < 0) return;
    panelRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, position]);

  const move = (from: number, step: 1 | -1) => {
    for (let index = from + step; index >= 0 && index < options.length; index += step) if (!options[index].disabled) return index;
    return from;
  };

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) { event.preventDefault(); openMenu(); }
      return;
    }
    switch (event.key) {
      case "ArrowDown": event.preventDefault(); setActive((current) => move(current, 1)); break;
      case "ArrowUp": event.preventDefault(); setActive((current) => move(current, -1)); break;
      case "Home": event.preventDefault(); setActive(move(-1, 1)); break;
      case "End": event.preventDefault(); setActive(move(options.length, -1)); break;
      case "Enter": case " ": event.preventDefault(); choose(active); break;
      case "Escape": event.preventDefault(); closeMenu(); break;
      case "Tab": setOpen(false); break;
      default:
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
          window.clearTimeout(typeahead.current.timer);
          typeahead.current.text += event.key.toLowerCase();
          typeahead.current.timer = window.setTimeout(() => { typeahead.current.text = ""; }, 600);
          const match = options.findIndex((option) => !option.disabled && option.label.toLowerCase().startsWith(typeahead.current.text));
          if (match >= 0) setActive(match);
        }
    }
  }

  const panelStyle: CSSProperties | undefined = position ? { left: position.left, width: position.width, maxHeight: position.maxHeight, top: position.top, bottom: position.bottom } : undefined;

  return <>
    <button
      ref={triggerRef} id={id} type="button" role="combobox"
      className={`ui-select-trigger${compact ? " compact" : ""}${open ? " is-open" : ""}${className ? ` ${className}` : ""}`}
      aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
      aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
      aria-label={label} aria-invalid={invalid || undefined} aria-describedby={describedBy} disabled={disabled}
      onClick={() => (open ? closeMenu(false) : openMenu())} onKeyDown={onKeyDown}
    >
      <span className={selected ? "ui-select-value" : "ui-select-value placeholder"}>{selected?.label ?? placeholder}</span>
      <ChevronDown size={16} aria-hidden="true" />
    </button>
    {open && position && createPortal(
      <ul ref={panelRef} id={listId} role="listbox" aria-label={label} className="ui-select-panel" style={panelStyle}>
        {options.map((option, index) => <li
          key={option.value} id={`${listId}-${index}`} data-index={index} role="option"
          aria-selected={option.value === value} aria-disabled={option.disabled || undefined}
          className={`ui-select-option${index === active ? " is-active" : ""}${option.value === value ? " is-selected" : ""}${option.disabled ? " is-disabled" : ""}`}
          onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => !option.disabled && setActive(index)} onClick={() => choose(index)}
        ><span>{option.label}</span>{option.value === value && <Check size={15} aria-hidden="true" />}</li>)}
      </ul>,
      document.body,
    )}
  </>;
}
