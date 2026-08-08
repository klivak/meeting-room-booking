"use client";

import { parseDate } from "@internationalized/date";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  DateInput,
  DatePicker as AriaDatePicker,
  DateSegment,
  Dialog,
  Group,
  Heading,
  I18nProvider,
  Label,
  Popover,
} from "react-aria-components";

import { CONTROL_CLASS } from "@/components/ui/Select";

type DatePickerProps = {
  id?: string;
  label: string;
  locale: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

const CALENDAR_BUTTON =
  "focus-ring-tight text-text-secondary hover:bg-surface-muted hover:text-text-primary rounded-[8px] flex size-9 items-center justify-center transition disabled:opacity-[0.35]";

/** Single-date picker that keeps the form's ISO string contract at its boundary. */
export function DatePicker({
  id,
  label,
  locale,
  value,
  onChange,
  error,
}: DatePickerProps) {
  const parsedValue = value ? parseDate(value) : null;

  return (
    <I18nProvider locale={locale}>
      <AriaDatePicker
        id={id}
        value={parsedValue}
        onChange={(nextValue) => onChange(nextValue?.toString() ?? "")}
        isInvalid={Boolean(error)}
        className="flex min-w-0 flex-col gap-1"
      >
        <Label className="text-text-secondary text-[11.5px] font-bold">
          {label}
        </Label>
        <Group
          className={`${CONTROL_CLASS} flex w-full items-center gap-1 py-0 pe-1.5 ps-3 ${
            error
              ? "border-danger border-[1.5px] shadow-[0_0_0_3px_var(--color-danger-surface)]"
              : ""
          }`}
        >
          <DateInput className="flex min-w-0 flex-1 items-center font-mono text-[13px]">
            {(segment) => (
              <DateSegment
                segment={segment}
                className="data-[focused]:bg-accent-own-surface data-[focused]:text-accent-own-ink rounded px-0.5 outline-none data-[placeholder]:text-text-tertiary"
              />
            )}
          </DateInput>
          <Button className="focus-ring-tight text-text-tertiary hover:bg-surface-muted hover:text-text-primary rounded-[8px] flex size-8 flex-none items-center justify-center transition">
            <CalendarDays aria-hidden="true" className="size-4" />
          </Button>
        </Group>
        {error ? (
          <p className="text-danger-ink text-xs" role="alert">
            {error}
          </p>
        ) : null}
        <Popover
          placement="bottom start"
          offset={6}
          className="bg-surface border-border-grid shadow-modal rounded-panel z-100 overflow-hidden border p-3 outline-none"
        >
          <Dialog className="outline-none">
            <Calendar className="w-[17.5rem] outline-none">
              <header className="mb-2 flex items-center justify-between">
                <Button slot="previous" className={CALENDAR_BUTTON}>
                  <ChevronLeft aria-hidden="true" className="size-4" />
                </Button>
                <Heading className="text-text-primary text-sm font-extrabold" />
                <Button slot="next" className={CALENDAR_BUTTON}>
                  <ChevronRight aria-hidden="true" className="size-4" />
                </Button>
              </header>
              <CalendarGrid className="w-full border-separate border-spacing-0.5">
                <CalendarGridHeader>
                  {(day) => (
                    <CalendarHeaderCell className="text-text-tertiary h-8 font-mono text-[10px] font-bold uppercase">
                      {day}
                    </CalendarHeaderCell>
                  )}
                </CalendarGridHeader>
                <CalendarGridBody>
                  {(date) => (
                    <CalendarCell
                      date={date}
                      className="focus-ring-tight text-text-secondary hover:bg-surface-muted data-[outside-month]:text-text-tertiary data-[selected]:bg-accent-own-ink data-[selected]:text-accent-own-on data-[today]:ring-accent-own-booking rounded-[8px] flex size-9 items-center justify-center font-mono text-xs font-semibold outline-none transition data-[disabled]:opacity-[0.35] data-[today]:ring-1"
                    />
                  )}
                </CalendarGridBody>
              </CalendarGrid>
            </Calendar>
          </Dialog>
        </Popover>
      </AriaDatePicker>
    </I18nProvider>
  );
}
