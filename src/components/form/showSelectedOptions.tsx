import { Check } from "lucide-react";
import { components, type GroupBase, type OptionProps } from "react-select";

function CheckedOption<O, M extends boolean, G extends GroupBase<O>>(props: OptionProps<O, M, G>) {
  return (
    <components.Option {...props}>
      <span className="flex items-center justify-between gap-2">
        <span className="min-w-0">{props.children}</span>
        {props.isSelected && <Check className="size-4 shrink-0" aria-hidden />}
      </span>
    </components.Option>
  );
}

/**
 * Для react-select с isMulti: выбранные пункты остаются в списке с галочкой,
 * а не пропадают из него — иначе по списку не понять, что уже выбрано.
 * Повторный клик по пункту снимает выбор.
 */
export const showSelectedOptions = {
  hideSelectedOptions: false,
  components: { Option: CheckedOption },
};
