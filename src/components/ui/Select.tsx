"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  Button,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select as AriaSelect,
  SelectValue,
} from "react-aria-components";

export const CONTROL_CLASS =
  "border-border-grid bg-surface text-text-primary rounded-control min-h-11 min-w-0 border px-2.5 text-sm font-semibold transition outline-none hover:border-border-control data-[focus-visible]:border-accent-own-booking data-[focus-visible]:border-[1.5px] data-[focus-visible]:shadow-[0_0_0_3px_var(--color-accent-own-surface)] sm:min-h-10";

export type SelectOption = {
  value: string;
  label: string;
};

type SelectProps = {
  id?: string;
  label?: string;
  ariaLabel?: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
};

/** Accessible select whose behaviour comes from React Aria and appearance from our tokens. */
export function Select({
  id,
  label,
  ariaLabel,
  value,
  onChange,
  options,
  disabled = false,
  invalid = false,
  className,
}: SelectProps) {
  return (
    <AriaSelect
      id={id}
      value={value}
      onChange={(nextValue) => {
        if (typeof nextValue === "string") {
          onChange(nextValue);
        }
      }}
      isDisabled={disabled}
      isInvalid={invalid}
      aria-label={ariaLabel}
      className="flex min-w-0 flex-col gap-1"
    >
      {label ? (
        <Label className="text-text-secondary text-[11.5px] font-bold">
          {label}
        </Label>
      ) : ariaLabel ? (
        <Label className="sr-only">{ariaLabel}</Label>
      ) : null}
      <Button
        className={`${CONTROL_CLASS} flex w-full items-center gap-2 pe-2.5 text-start disabled:cursor-not-allowed disabled:opacity-[0.45] ${
          invalid
            ? "border-danger border-[1.5px] shadow-[0_0_0_3px_var(--color-danger-surface)]"
            : ""
        } ${className ?? ""}`}
      >
        <SelectValue className="min-w-0 flex-1 truncate" />
        <ChevronDown
          aria-hidden="true"
          className="text-text-tertiary size-4 flex-none"
        />
      </Button>
      <Popover
        placement="bottom start"
        offset={6}
        // React Aria exposes the trigger width and remaining viewport height;
        // using both keeps the list aligned without letting it leave the screen.
        className="bg-surface border-border-grid shadow-modal rounded-control z-100 max-h-[min(18rem,var(--available-height))] w-[var(--trigger-width)] min-w-[12rem] overflow-hidden border outline-none"
      >
        <ListBox className="max-h-[min(18rem,var(--available-height))] overflow-y-auto p-1.5 outline-none">
          {options.map((option) => (
            <ListBoxItem
              key={option.value}
              id={option.value}
              textValue={option.label}
              className="text-text-secondary data-[focused]:bg-surface-muted data-[focused]:text-text-primary data-[selected]:text-accent-own-ink rounded-[8px] flex min-h-10 cursor-default items-center gap-2 px-2.5 py-2 text-[13px] font-semibold outline-none data-[selected]:font-bold"
            >
              {({ isSelected }) => (
                <>
                  <span className="min-w-0 flex-1 truncate">
                    {option.label}
                  </span>
                  <span className="flex w-4 flex-none justify-center">
                    {isSelected ? (
                      <Check aria-hidden="true" className="size-4" />
                    ) : null}
                  </span>
                </>
              )}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </AriaSelect>
  );
}
