import { Children, cloneElement, isValidElement, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import "./PremiumSelect.css";

const flattenOptions = (children) => {
  const items = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === "option") {
      const value = child.props.value ?? child.props.children ?? "";
      const label = Children.toArray(child.props.children).join("");
      items.push({
        value: String(value),
        label: label || String(value),
        disabled: Boolean(child.props.disabled),
      });
      return;
    }
    if (child.props?.children) items.push(...flattenOptions(child.props.children));
  });
  return items;
};

const PremiumSelect = ({
  value = "",
  onChange,
  children,
  className = "",
  disabled = false,
  id,
  name,
  "aria-label": ariaLabel,
  title,
}) => {
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 220, maxHeight: 320 });

  const options = useMemo(() => flattenOptions(children), [children]);
  const selectedIndex = Math.max(0, options.findIndex((item) => String(item.value) === String(value)));
  const selected = options[selectedIndex] || options[0] || { value: "", label: "Select" };

  const locate = () => {
    const rect = triggerRef.current?.getBoundingClientRect?.();
    if (!rect) return;
    const width = Math.max(180, Math.min(360, rect.width));
    const gap = 7;
    const viewportPad = 10;
    const roomBelow = window.innerHeight - rect.bottom - viewportPad;
    const roomAbove = rect.top - viewportPad;
    const maxHeight = Math.max(150, Math.min(360, Math.max(roomBelow, roomAbove) - gap));
    const placeAbove = roomBelow < 180 && roomAbove > roomBelow;
    const top = placeAbove
      ? Math.max(viewportPad, rect.top - Math.min(maxHeight, options.length * 43 + 14) - gap)
      : Math.min(window.innerHeight - viewportPad - 50, rect.bottom + gap);
    const left = Math.max(viewportPad, Math.min(window.innerWidth - width - viewportPad, rect.left));
    setPosition({ top, left, width, maxHeight });
  };

  const emit = (nextValue) => {
    const synthetic = {
      target: { value: nextValue, name },
      currentTarget: { value: nextValue, name },
    };
    onChange?.(synthetic);
  };

  const choose = (option) => {
    if (option?.disabled) return;
    emit(option?.value ?? "");
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus?.(), 0);
  };

  const toggle = () => {
    if (disabled) return;
    if (!open) {
      locate();
      setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }
    setOpen((current) => !current);
  };

  useEffect(() => {
    if (!open) return undefined;
    const outside = (event) => {
      if (triggerRef.current?.contains(event.target) || panelRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const move = () => locate();
    const key = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus?.();
      }
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", move);
    window.addEventListener("scroll", move, true);
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", move);
      window.removeEventListener("scroll", move, true);
      window.removeEventListener("keydown", key);
    };
  }, [open, options.length]);

  const onTriggerKeyDown = (event) => {
    if (disabled) return;
    if (!open && ["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      locate();
      setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
      setOpen(true);
      return;
    }
    if (!open) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      let next = activeIndex;
      for (let i = 0; i < options.length; i += 1) {
        next = (next + direction + options.length) % options.length;
        if (!options[next]?.disabled) break;
      }
      setActiveIndex(next);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(options[activeIndex]);
    }
  };

  const panel = open ? (
    <div
      ref={panelRef}
      className="sw2324-select-menu"
      role="listbox"
      aria-label={ariaLabel || title || "Select option"}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: `${position.width}px`,
        maxHeight: `${position.maxHeight}px`,
      }}
    >
      {options.map((option, index) => {
        const isSelected = String(option.value) === String(value);
        const isActive = index === activeIndex;
        return (
          <button
            key={`${option.value}-${index}`}
            type="button"
            role="option"
            aria-selected={isSelected}
            disabled={option.disabled}
            className={`${isSelected ? "selected" : ""} ${isActive ? "active" : ""}`.trim()}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => choose(option)}
          >
            <span>{option.label}</span>
            {isSelected ? <Check size={15} /> : null}
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`sw2324-premium-select ${className}`.trim()}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        title={title}
        onClick={toggle}
        onKeyDown={onTriggerKeyDown}
      >
        <span>{selected?.label || "Select"}</span>
        <ChevronDown size={15} className={open ? "open" : ""} />
      </button>
      {open && typeof document !== "undefined" ? createPortal(panel, document.body) : null}
    </>
  );
};

export default PremiumSelect;
