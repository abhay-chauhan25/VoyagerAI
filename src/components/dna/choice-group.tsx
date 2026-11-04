"use client";

import { useId } from "react";

type Option = { value: string; label: string };

type Props = {
  legend: string;
  hint?: string;
  name: string;
  type: "radio" | "checkbox";
  options: readonly Option[];
  selected: readonly string[];
  onChange: (values: string[]) => void;
};

/**
 * Segmented choices built on real radio/checkbox inputs, so keyboard and screen-reader behaviour
 * comes for free. Works inside a form (submits `name`) or as a controlled field.
 */
export function ChoiceGroup({ legend, hint, name, type, options, selected, onChange }: Props) {
  const hintId = useId();
  return (
    <fieldset className="flex flex-col gap-3" aria-describedby={hint ? hintId : undefined}>
      <legend className="pb-1 text-body font-semibold">{legend}</legend>
      {hint ? (
        <p id={hintId} className="-mt-2 text-meta text-muted">
          {hint}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const checked = selected.includes(option.value);
          return (
            <label
              key={option.value}
              className={`pressable flex min-h-11 cursor-pointer items-center rounded-control border px-4 text-ui has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
                checked
                  ? "border-primary bg-primary font-semibold text-primary-ink"
                  : "border-control bg-panel text-ink hover:bg-raised"
              }`}
            >
              <input
                type={type}
                name={name}
                value={option.value}
                checked={checked}
                onChange={(event) => {
                  if (type === "radio") onChange([option.value]);
                  else
                    onChange(
                      event.target.checked
                        ? [...selected, option.value]
                        : selected.filter((value) => value !== option.value),
                    );
                }}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
